var applySelectorAndCss = require('apply-selector-and-css');

var REG_CHECK_V = /^TAP version (\d+)/;
var REG_TEST_START = /^# (.*)/;
var REG_PASS = /^ok (\d+) (.*)/;
var REG_FAIL = /^not ok (\d+) (.*)/;
var REG_FAIL_REASON_START = /^  ---/;
var REG_FAIL_REASON_END = /^  \.\.\./;
var REG_END_START = /^\d+..\d+/;
var REG_END_COUNT_TESTS = /^# tests (\d+)/;
var REG_END_COUNT_TESTS_PASS = /^# pass  (\d+)/;
var REG_END_COUNT_TESTS_FAIL = /^# fail  (\d+)/;

var CLASS_NAMES = {

  TAP_MAIN_PASS: '.tap-browser-el.pass',
  TAP_MAIN_FAIL: '.tap-browser-el.fail',
  TAP_TEST_NAME_PASS: '.tap-testname.pass',
  TAP_TEST_NAME_FAIL: '.tap-testname.fail',
  TAP_TEST_PASS: '.tap-test.pass',
  TAP_TEST_FAIL: '.tap-test.fail',
  TAP_TESTPART_PASS: '.tap-test-part.pass',
  TAP_TESTPART_FAIL: '.tap-test-part.fail',
  TAP_RESULT_PASS: '.tap-result.pass',
  TAP_RESULT_FAIL: '.tap-result.fail',
  TAP_FAIL_REASON: '.tap-test-part.reason.fail'
};

var COL_BORDER_PASS = '#97efd9';
var COL_BORDER_FAIL = '#EC92AD';

var originalLog;
var el;
var applySelector;
var onFinishedTestPart = function() {};
var onFinishedTest = function() {};
var onFinished = function() {};
var c = {
  log: function() {
    originalLog.apply(console, arguments);
  }
};

module.exports = function(options) {

  var o = options || {};

  // if no css is defined use default
  if(o.css === undefined) {

    o.css = {
      '.tap-browser-el': {
        'color': '#6D667F',
        'background': '#100E16',
        'font-family': 'Verdana, Geneva, sans-serif',
        'font-size': '14px',
        'word-wrap': 'break-word'
      },

      '.tap-test.pass': {
        'border-left': '5px solid ' + COL_BORDER_PASS
      },

      '.tap-test.fail': {
        'border-left': '5px solid ' + COL_BORDER_FAIL
      },

      '.tap-testname': {
        'font-weight': '500',
        'font-size': '20px',
        'background': '#1D1829',
        'color': '#928BA9',
        'padding': '10px 20px 10px 10px'
      },

      '.tap-result': {
        'font-weight': '500',
        'font-size': '20px',
        'background': '#1D1829',
        'color': '#928BA9',
        'padding': '10px 10px 10px 10px'
      },

      '.tap-result.pass': {
        'border-left': '5px solid ' + COL_BORDER_PASS
      },

      '.tap-result.fail': {
        'border-left': '5px solid ' + COL_BORDER_FAIL
      },

      '.reason': {
        'border-left': '5px solid ' + COL_BORDER_FAIL,
        'padding': '0px 20px 0px 10px'
      },

      '.tap-test-part': {
        'padding': '0px 20px 0px 5px',
        'margin-left': '20px'
      },

      '.tap-test-part.pass': {
        'border-left': '10px solid ' + COL_BORDER_PASS
      },

      '.tap-test-part.fail': {
        'border-left': '10px solid ' + COL_BORDER_FAIL
      }
    };
  } 

  // if theres then use it
  applySelector = applySelectorAndCss(o.css);

  if(!o.el) {
    el = getEL(CLASS_NAMES.TAP_MAIN_PASS);
    document.body.appendChild(el);
  } else {
    el = o.el;
    applySelector(el, CLASS_NAMES.TAP_MAIN_PASS);
  }

  onFinished = o.onFinished || onFinished;
  onFinishedTest = o.onFinishedTest || onFinishedTest;
  onFinishedTestPart = o.onFinishedTestPart || onFinishedTestPart;

  originalLog = console.log;
  console.log = newLog;
};

module.exports.log = function() {

  c.log.apply(c, arguments);
};

function newLog() {

  // export to console anyway
  c.log.apply(c, arguments);

  // parse output
  parseLogs.call(undefined, arguments[0]);
}

function parseLogs(line) {

  var nEl;
  var regResult;
  var test;

  // we haven't received start so we'll continue looking for it
  if(!this.receivedStart) {

    regResult = REG_CHECK_V.exec(line);

    if(regResult) {

      this.receivedStart = true;

      if(parseFloat(regResult[1]) != 13 ) {
        console.warn('it seems tap is version', regResult[0], 'which may not be compatible with tap-browser-el');
      }
    }
  // we've recived start so just start parsing other stuff
  } else {

    this.startedEnd = this.startedEnd || testStartedEnd(line);

    // we haven't started the end sequence output
    if(!this.startedEnd) {

      test = getCurrentTest(line);

      if(test) {
        test.parse(line);
      }
    // we have started the end sequence output
    } else {

      parseEnd(line);
    }
  }
}

function testStartedEnd(line) {

  return REG_END_START.test(line);
}

function parseEnd(line) {
  var regResult;
  var cEl;

  // need to call this the first time we start parsing end
  if(!this.isNotFirstParse) {
    this.isNotFirstParse = true;

    process.nextTick(onFinishedTest);
  }

  if(this.numPassed === undefined) {

    regResult = REG_END_COUNT_TESTS_PASS.exec(line);

    if(regResult) {
      this.numPassed = parseInt(regResult[ 1 ]);
    }
  } else {

    regResult = REG_END_COUNT_TESTS_FAIL.exec(line);

    if(regResult) {
      this.numFail = parseInt(regResult[ 1 ]);
    }

    if(this.numFail === 0 ) {

      cEl = getEL(CLASS_NAMES.TAP_RESULT_PASS);
    } else {

      cEl = getEL(CLASS_NAMES.TAP_RESULT_FAIL);
    }
    
    cEl.innerHTML = 'Passed: ' + this.numPassed + ' / ' + ( this.numPassed + this.numFail );
    el.appendChild(cEl);

    process.nextTick(onFinished);

    // reset numPassed so this test can be run again
    this.numPassed = undefined;
  }
}

function getCurrentTest(line) {

  var regResult = REG_TEST_START.exec(line);

  if(regResult) {

    if(this.cTest) {
      process.nextTick(onFinishedTest);
    }

    this.cTest = getTest(regResult[1]);
  } else {

    return this.cTest;
  }
}

function getTest(name) {

  var hasFailed = false;
  var isFailing = false;
  var hasFailReasonStarted = false;
  var testEl = getEL(CLASS_NAMES.TAP_TEST_PASS);
  var testNameEl = getEL(CLASS_NAMES.TAP_TEST_NAME_PASS);
  var cEl;
  testNameEl.innerHTML = name;

  testEl.appendChild(testNameEl);
  el.appendChild(testEl);

  return {

    parse: function(line) {

      var regResult;
      var hasFailEnded;

      // if we're currently not failing then parse as ussual
      if(!isFailing) {
        regResult = REG_PASS.exec(line);

        // this test passed
        if(regResult) {

          cEl = getEL(CLASS_NAMES.TAP_TESTPART_PASS);
          cEl.innerHTML = regResult[ 1 ] + '. ' + regResult[ 2 ];
          testEl.appendChild(cEl);

          onFinishedTestPart();
        } else {

          regResult = REG_FAIL.exec(line);

          if(regResult) {

            // make the main test el fail
            if(!hasFailed) {
              hasFailed = true;
              applySelector(testEl, CLASS_NAMES.TAP_TEST_FAIL);
              applySelector(testNameEl, CLASS_NAMES.TAP_TEST_NAME_FAIL);
            }

            applySelector(el, CLASS_NAMES.TAP_MAIN_FAIL);
            
            isFailing = true;
            cEl = getEL(CLASS_NAMES.TAP_TESTPART_FAIL);
            cEl.innerHTML = regResult[ 1 ] + '. ' + regResult[ 2 ];
            testEl.appendChild(cEl);
          }
        }
      // we're currently failing
      } else {

        if(!hasFailReasonStarted) {
          hasFailReasonStarted = REG_FAIL_REASON_START.test(line);
        } else{

          hasFailEnded = REG_FAIL_REASON_END.test(line);

          // if failing hasn't ended yet them we'll continue to add fail reason lines
          if(!hasFailEnded) {

            cEl = getEL(CLASS_NAMES.TAP_FAIL_REASON);
            cEl.innerHTML = line;
            testEl.appendChild(cEl);
          // if the failing has ended then we'll let tap continue as ussual
          } else {

            onFinishedTestPart();
            
            hasFailReasonStarted = false;
            isFailing = false;
          }
        }
      }
    }
  };
}

function getEL(className) {
  var el = document.createElement('div');

  applySelector(el, className);

  return el;
}