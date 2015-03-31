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
var REG_END_FINAL_OK = /^# ok/;

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
var outPutToConsole = true;
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

  outPutToConsole = o.outPutToConsole === undefined ? true : o.outPutToConsole;

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

  var wasTap = parseLogs.call(undefined, arguments[0]);

  // always export non tap console
  if(!wasTap) {
    c.log.apply(c, arguments);
  // if we should output tap then do it
  } else if(outPutToConsole) {
    c.log.apply(c, arguments);
  } 
}

function parseLogs(line) {

  var wasTap = false;
  var nEl;
  var regResult;
  var test;
  

  // we haven't received start so we'll continue looking for it
  if(!this.receivedStart) {

    regResult = REG_CHECK_V.exec(line);

    if(regResult) {
      wasTap = true;
      this.receivedStart = true;

      if(parseFloat(regResult[1]) != 13 ) {
        console.warn('it seems tap is version', regResult[0], 'which may not be compatible with tap-browser-el');
      }
    }
  // we've recived start so just start parsing other stuff
  } else {

    // if this was the end call
    wasTap = testStartedEnd(line);
    this.startedEnd = this.startedEnd || wasTap;

    // we haven't started the end sequence output
    if(!this.startedEnd) {

      test = getCurrentTest(line);

      // if this current test is not the new text then
      // there was new tap output
      if(test !== this.test) {

        wasTap = true;
        this.test = test;
      }

      if(this.test) {
        wasTap = wasTap || this.test.parse(line);
      }
    // we have started the end sequence output
    } else {

      wasTap = wasTap || parseEnd(line);
    }
  }

  return wasTap;
}

function testStartedEnd(line) {

  return REG_END_START.test(line);
}

function parseEnd(line) {
  var wasTap = false;
  var regResult;
  var cEl;

  // need to call this the first time we start parsing end
  if(!this.isNotFirstParse) {
    this.isNotFirstParse = true;

    process.nextTick(onFinishedTest);
  }

  if(this.numPassed === undefined) {

    // check if this is just simply the count of tests if so just say it was tap out
    regResult = REG_END_COUNT_TESTS.exec(line);

    // it was just the number of tests
    if(regResult) {
      wasTap = true;
    // it was not the number of tests so test if it was the count passing
    } else {

      regResult = REG_END_COUNT_TESTS_PASS.exec(line);

      if(regResult) {
        wasTap = true;
        this.numPassed = parseInt(regResult[ 1 ]);
      }
    }
  } else {

    regResult = REG_END_COUNT_TESTS_FAIL.exec(line);

    if(regResult) {
      wasTap = true;
      this.numFail = parseInt(regResult[ 1 ]);
    }

    if(this.numFail === 0 ) {

      cEl = getEL(CLASS_NAMES.TAP_RESULT_PASS);
    } else {

      cEl = getEL(CLASS_NAMES.TAP_RESULT_FAIL);
    }
    
    this.numPassed = this.numPassed || 0;
    this.numFail = this.numFail || 0;

    cEl.innerHTML = 'Passed: ' + this.numPassed + ' / ' + ( this.numPassed + this.numFail );
    el.appendChild(cEl);

    process.nextTick(onFinished);

    // reset numPassed so this test can be run again
    this.numFail = undefined;
    this.numPassed = undefined;
  }

  // if we haven't found tap output just check for the final ok which is
  // exported when all tests have passed
  if(!wasTap) {
    wasTap = REG_END_FINAL_OK.test(line);
  }

  return wasTap;
}

function getCurrentTest(line) {

  var regResult = REG_TEST_START.exec(line);

  if(regResult) {

    if(this.cTest) {
      process.nextTick(onFinishedTest);
    }

    this.cTest = getTest(regResult[1]);
  }

  return this.cTest;
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
      var wasTap = false;
      var regResult;
      var hasFailEnded;

      // if we're currently not failing then parse as ussual
      if(!isFailing) {
        regResult = REG_PASS.exec(line);

        // this test passed
        if(regResult) {
          wasTap = true;
          cEl = getEL(CLASS_NAMES.TAP_TESTPART_PASS);
          cEl.innerHTML = regResult[ 1 ] + '. ' + regResult[ 2 ];
          testEl.appendChild(cEl);

          onFinishedTestPart();
        } else {

          regResult = REG_FAIL.exec(line);

          if(regResult) {
            wasTap = true;

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
          hasFailReasonStarted = wasTap = REG_FAIL_REASON_START.test(line);
        } else{

          hasFailEnded = wasTap = REG_FAIL_REASON_END.test(line);

          // if failing hasn't ended yet them we'll continue to add fail reason lines
          if(!hasFailEnded) {

            wasTap = true;
            cEl = getEL(CLASS_NAMES.TAP_FAIL_REASON);
            cEl.innerHTML = line;
            testEl.appendChild(cEl);
          // if the failing has ended then we'll let tap continue as ussual
          } else {

            wasTap = true;
            onFinishedTestPart();
            hasFailReasonStarted = false;
            isFailing = false;
          }
        }
      }

      return wasTap;
    }
  };
}

function getEL(className) {
  var el = document.createElement('div');

  applySelector(el, className);

  return el;
}