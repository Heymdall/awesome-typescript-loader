import * as path from 'path';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as child from 'child_process';

import { LoaderConfig } from '../interfaces';

require('source-map-support').install();

import { expect } from 'chai';
export { expect };

const webpack = require('webpack');
const BPromise = require('bluebird');

const mkdirp = BPromise.promisify(require('mkdirp'));
// const rimraf = BPromise.promisify(require('rimraf'));
const readFile = BPromise.promisify(fs.readFile);
const writeFile = BPromise.promisify(fs.writeFile);

export const defaultOutputDir = path.join(process.cwd(), '.test');
export const defaultFixturesDir = path.join(process.cwd(), 'fixtures');

export interface ConfigOptions {
    loaderQuery?: LoaderConfig;
    watch?: boolean;
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
}

const TEST_DIR = path.join(process.cwd(), '.test');
const SRC_DIR = './src';
const OUT_DIR = './out';
const WEBPACK = path.join(
    path.dirname(
        path.dirname(
            require.resolve('webpack'))), 'bin', 'webpack.js');

mkdirp.sync(TEST_DIR);

const LOADER = path.join(process.cwd(), 'index.js');

export function entry(file: string) {
    return config => {
        config.entry.index = path.join(process.cwd(), SRC_DIR, file);
    };
}

export function query(q: any) {
    return config => {
        _.merge(
            config.module.loaders.find(loader =>
                loader.loader === LOADER).query,
            q
        );
    };
}

export function webpackConfig(...enchance: any[]) {
    const config = {
        entry: { index: path.join(process.cwd(), SRC_DIR, 'index.ts') },
        output: {
            path: path.join(process.cwd(), OUT_DIR),
            filename: '[name].js'
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
        module: {
            loaders: [
                {
                    test: /\.(tsx?|jsx?)/,
                    loader: LOADER,
                    include: [ path.join(process.cwd(), SRC_DIR) ],
                    query: {
                        silent: true
                    }
                }
            ]
        }
    };

    enchance.forEach(e => e(config));
    return config;
}

export interface Output {
    type: 'stderr' | 'stdout';
    data: string;
}

export type OutputMatcher = (o: Output) => boolean;

export class Exec {
    process: child.ChildProcess;
    watchers: {
        resolve: any,
        reject: any,
        matchers: OutputMatcher[],
    }[] = [];

    close() {
        this.process.kill();
    }

    invoke({stdout, stderr}) {
        this.watchers = this.watchers.filter(watcher => {
            const output: Output  = {
                type: stdout ? 'stdout' : 'stderr',
                data: stdout || stderr
            };

            const index = watcher.matchers.findIndex(m => m(output));

            if (index === -1) {
                watcher.reject(new Error(`Unexpected ${output.type}:\n${output.data}`));
                return false;
            }

            watcher.matchers.splice(index, 1);
            if (watcher.matchers.length === 0) {
                watcher.resolve();
                return false;
            } else {
                return true;
            }
        });
    }

    wait(...matchers: OutputMatcher[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const watcher = {
                resolve,
                reject,
                matchers,
            };

            this.watchers.push(watcher);
        });
    }

    alive(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.process.on('exit', resolve);
        });
    }
}

export type Test = string | (string | [boolean, string])[] | RegExp | ((str: string) => boolean);
export function streamTest(stream = 'stdout', test: Test) {
    let matcher: (str: string) => boolean;

    if (typeof test === 'string') {
        matcher = (o: string) => o.indexOf(test) !== -1;
    } else if (Array.isArray(test)) {
        matcher = (o: string) => test.every(test => {
            if (typeof test === 'string') {
                return o.indexOf(test) !== -1;
            } else {
                const [flag, str] = test;
                if (flag) {
                     return o.indexOf(str) !== -1;
                } else {
                    return o.indexOf(str) === -1;
                }
            }
        });
    } else if (test instanceof RegExp) {
        matcher => (o: string) => test.test(o);
    } else {
        matcher = test;
    }

    return (o: Output) => (o.type === stream) && matcher(o.data);
}

export const stdout = (test: Test) => streamTest('stdout', test);
export const stderr = (test: Test) => streamTest('stderr', test);

export function exec(command: string, args?: string[], options?: child.SpawnOptions) {
    const p = child.spawn('node', [WEBPACK].concat(args), {
        shell: false,
        stdio: 'pipe',
        env: process.env
    });

    const waiter = new Exec();

    p.stdout.on('data', (data) => {
        console.log(data.toString());
        waiter.invoke({ stdout: data.toString(), stderr: null });
    });

    p.stderr.on('data', (data) => {
        console.error(data.toString());
        waiter.invoke({ stdout: null, stderr: data.toString() });
    });

    process.on('beforeExit', () => {
        p.kill();
    });

    process.on('exit', () => {
        p.kill();
    });

    waiter.process = p;
    return waiter;
}

export function expectErrors(stats: any, count: number, errors: string[] = []) {
    stats.compilation.errors.every(err => {
        const str = err.toString();
        expect(errors.some(e => str.indexOf(e) !== -1), 'Error is not covered: \n' + str).true;
    });

    expect(stats.compilation.errors.length).eq(count);
}

export function tsconfig(compilerOptions?: any, config?: any) {
    const res = _.merge({
        compilerOptions: _.merge({
            target: 'es6'
        }, compilerOptions)
    }, config);
    return file('tsconfig.json', json(res));
}

export function install(...name: string[]) {
    return child.execSync(`yarn add ${name.join(' ')}`);
}

export function json(obj) {
    return JSON.stringify(obj, null, 4);
}

export function checkOutput(fileName: string, fragment: string) {
    const source = readOutput(fileName);

    if (!source) { process.exit(); }

    expect(source.replace(/\s/g, '')).include(fragment.replace(/\s/g, ''));
}

export function readOutput(fileName: string) {
    return fs.readFileSync(path.join(OUT_DIR, fileName || 'index.js')).toString();
}

export function touchFile(fileName: string): Promise<any> {
    return readFile(fileName)
        .then(buf => buf.toString())
        .then(source => writeFile(fileName, source));
}

export function compile(config?): Promise<any> {
    return new Promise((resolve, reject) => {
        const compiler = webpack(config);

        compiler.run((err, stats) => {
            if (err) {
                reject(err);
            } else {
                resolve(stats);
            }
        });
    });
}

export interface TestEnv {
    TEST_DIR: string;
    OUT_DIR: string;
    SRC_DIR: string;
    LOADER: string;
    WEBPACK: string;
}

export function spec<T>(name: string, cb: (env: TestEnv, done?: () => void) => Promise<T>, disable = false) {
    const runner = (done?) => {
        const temp = path.join(
            TEST_DIR,
            path.basename(name).replace('.', '') + '-' +
                (new Date()).toTimeString()
                    .replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1")
                    .replace(/:/g, "-")
        );

        mkdirp.sync(temp);
        let cwd = process.cwd();
        process.chdir(temp);
        pkg();

        const env = {
            TEST_DIR,
            OUT_DIR,
            SRC_DIR,
            LOADER,
            WEBPACK
        };

        const promise = cb(env, done);
        return promise
            .then(a => {
                process.chdir(cwd);
                return a;
            })
            .catch(e => {
                process.chdir(cwd);
                throw e;
            });
    };

    const asyncRunner = cb.length === 2
        ? (done) => { runner(done).catch(done); return; }
        : () => runner();

    if (disable) {
        xit(name, asyncRunner);
    } else {
        it(name, asyncRunner);
    }
}

export function xspec<T>(name: string, cb: () => Promise<T>) {
    return spec(name, cb, true);
}

export function watch(config, cb?: (err, stats) => void): Watch {
    let compiler = webpack(config);
    let watch = new Watch();
    let webpackWatcher = compiler.watch({}, (err, stats) => {
        watch.invoke(err, stats);
        if (cb) {
            cb(err, stats);
        }
    });

    watch.close = webpackWatcher.close;
    return watch;
}

export class Watch {
    close: () => void;

    private resolves: {resolve: any, reject: any}[] = [];

    invoke(err, stats) {
        this.resolves.forEach(({resolve, reject}) => {
            if (err) {
                reject(err);
            } else {
                resolve(stats);
            }
        });
        this.resolves = [];
    }

    wait(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.resolves.push({resolve, reject});
        });
    }
}

export function pkg() {
    file('package.json', `
        {
            "name": "test",
            "license": "MIT"
        }
    `);
}

export function src(fileName: string, text: string) {
    return new Fixture(path.join(SRC_DIR, fileName), text);
}

export function file(fileName: string, text: string) {
    return new Fixture(fileName, text);
}

export class Fixture {
    private text: string;
    private fileName: string;
    constructor(fileName: string, text: string) {
        this.text = text;
        this.fileName = fileName;
        mkdirp.sync(path.dirname(this.fileName));
        fs.writeFileSync(this.fileName, text);
    }

    path() {
        return this.fileName;
    }

    toString() {
        return this.path();
    }

    touch() {
        touchFile(this.fileName);
    }

    update(updater: (text: string) => string) {
        let newText = updater(this.text);
        this.text = newText;
        fs.writeFileSync(this.fileName, newText);
    }

    remove() {
        fs.unlinkSync(this.fileName);
    }
}
