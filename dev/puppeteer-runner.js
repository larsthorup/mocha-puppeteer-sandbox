import * as fs from 'fs';
import * as util from 'util';
import httpServer from 'http-server';
import puppeteer from 'puppeteer-core';

// Note: inspired by https://github.com/direct-adv-interfaces/mocha-headless-chrome/

const root = '.';
const port = 8081;
const url = `http://127.0.0.1:${port}/dev/mocha-runner.html`;
const reporter = 'dot';
const timeout = 60000;
const chromePath =
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const main = async () => {
  try {
    await startingServer();
    const mochaResult = await runningMochaInPuppeteer();
    await writingResult(mochaResult);
    process.exit(mochaResult.result.stats.failures > 0 ? 1 : 0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

const startingServer = async () => {
  const server = httpServer.createServer({ root });
  await new Promise((resolve) => server.listen(port, 'localhost', resolve));
};

const runningMochaInPuppeteer = async () => {
  const options = {
    executablePath: chromePath,
  };
  const browser = await puppeteer.launch(options);
  const pages = await browser.pages();
  const page = pages.pop();
  page.on('console', (msg) => {
    const args = msg._args;
    Promise.all(args.map((a) => a.jsonValue().catch(() => ''))).then((args) => {
      // process stdout stub
      let isStdout = args[0] === 'stdout:';
      isStdout && (args = args.slice(1));

      let msg = util.format(...args);
      !isStdout && msg && (msg += '\n');
      process.stdout.write(msg);
    });
  });
  page.on('pageerror', ({ message }) => {
    console.error(message);
  });
  page.on('response', (response) => {
    // console.log(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    console.error(`${request.failure().errorText} ${request.url()}`);
  });
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.evaluateOnNewDocument(initMocha, reporter);
  await page.goto(url);
  await page.waitForFunction(() => window.__mochaResult__, {
    timeout,
  });
  const mochaResult = await page.evaluate(() => window.__mochaResult__);
  await browser.close();
  return mochaResult;
};

const writingResult = (mochaResult) => {
  fs.mkdirSync('output/test', { recursive: true });
  fs.writeFileSync(
    'output/test/mocha-test-result.json',
    JSON.stringify(mochaResult, null, 2)
  );
  // TODO: save coverage
};

function initMocha(reporter) {
  console.log = ((console) => {
    const log = console.log.bind(console);
    return (...args) => (args.length ? log(...args) : log(''));
  })(console);

  function shimMochaInstance(m) {
    const originalReporter = m.reporter.bind(m);
    let reporterIsChanged = false;

    m.reporter = (...args) => {
      reporterIsChanged = true;
      originalReporter(...args);
    };

    const run = m.run.bind(m);

    m.run = () => {
      const all = [],
        pending = [],
        failures = [],
        passes = [];

      function error(err) {
        if (!err) return {};

        let res = {};
        Object.getOwnPropertyNames(err).forEach((key) => (res[key] = err[key]));
        return res;
      }

      function clean(test) {
        return {
          title: test.title,
          fullTitle: test.fullTitle(),
          duration: test.duration,
          err: error(test.err),
        };
      }

      function result(stats) {
        return {
          result: {
            stats: {
              tests: all.length,
              passes: passes.length,
              pending: pending.length,
              failures: failures.length,
              start: stats.start.toISOString(),
              end: stats.end.toISOString(),
              duration: stats.duration,
            },
            tests: all.map(clean),
            pending: pending.map(clean),
            failures: failures.map(clean),
            passes: passes.map(clean),
          },
          coverage: window.__coverage__,
        };
      }

      function setResult() {
        !window.__mochaResult__ &&
          (window.__mochaResult__ = result(this.stats));
      }

      !reporterIsChanged &&
        m.setup({
          reporter: Mocha.reporters[reporter] || Mocha.reporters.spec,
        });

      const runner = run(() => setTimeout(() => setResult.call(runner), 0))
        .on('pass', (test) => {
          passes.push(test);
          all.push(test);
        })
        .on('fail', (test) => {
          failures.push(test);
          all.push(test);
        })
        .on('pending', (test) => {
          pending.push(test);
          all.push(test);
        })
        .on('end', setResult);

      return runner;
    };
  }

  function shimMochaProcess(M) {
    // Mocha needs a process.stdout.write in order to change the cursor position.
    !M.process && (M.process = {});
    !M.process.stdout && (M.process.stdout = {});

    M.process.stdout.write = (data) => console.log('stdout:', data);
    M.reporters.Base.useColors = true;
    M.reporters.none = function None(runner) {
      M.reporters.Base.call(this, runner);
    };
  }

  Object.defineProperty(window, 'mocha', {
    get: function () {
      return undefined;
    },
    set: function (m) {
      shimMochaInstance(m);
      delete window.mocha;
      window.mocha = m;
    },
    configurable: true,
  });

  Object.defineProperty(window, 'Mocha', {
    get: function () {
      return undefined;
    },
    set: function (m) {
      shimMochaProcess(m);
      delete window.Mocha;
      window.Mocha = m;
    },
    configurable: true,
  });
}

main();
