'use strict';

const events = require('events');
const serverPort = 36001;
const librato = require('../lib/librato.js');
const nock = require('nock');
const sinon = require('sinon');
const http = require('http');

const config = {
  debug: false,
  librato: {
    email: '-@-',
    token: '-',
    api: 'http://127.0.0.1:' + serverPort,
    writeToLegacy: false,
  },
};

module.exports.debugConfig = {
  setUp: function(callback) {
    this.emitter = new events.EventEmitter();
    global.util = this.util = require('util');
    this.apiServer = nock('http://127.0.0.1:36001')
                         .defaultReplyHeaders({'Content-Type': 'application/json'});


    this.logSpy = sinon.spy(global.util, 'log');

    callback();
  },

  tearDown: function(callback) {
    config.debug = false;
    global.util.log.restore();
    callback();
  },

  testDebugConfigTrue: function(test) {
    test.expect(1);

    config.debug = true;
    let metrics = {gauges: {my_gauge: 1}};

    librato.init(null, config, this.emitter, this.util);
    this.emitter.emit('flush', 123, metrics);

    test.ok(this.logSpy.called);
    test.done();
  },

  testDebugConfigFalse: function(test) {
    test.expect(1);

    let metrics = {gauges: {my_gauge: 1}};

    librato.init(null, config, this.emitter, this.util);
    test.ok(!this.logSpy.called);

    this.emitter.emit('flush', 123, metrics);
    test.done();
  },

  testNoLogger: function(test) {
    test.expect(1);

    let metrics = {gauges: {my_gauge: 1}};

    librato.init(null, config, this.emitter);
    test.ok(!this.logSpy.called);

    this.emitter.emit('flush', 123, metrics);
    test.done();
  },

  testLoggerNoDebugConfig: function(test) {
    test.expect(1);
    let metrics = {gauges: {my_gauge: 1}};
    config.debug = null;

    librato.init(null, config, this.emitter, this.util);
    test.ok(!this.logSpy.called);

    this.emitter.emit('flush', 123, metrics);
    test.done();
  },

};

module.exports.tags = {
  setUp: function(callback) {
    this.emitter = new events.EventEmitter();

    this.apiServer = nock('http://127.0.0.1:36001')
                         .defaultReplyHeaders({'Content-Type': 'application/json'});

    librato.init(null, config, this.emitter);
    this.httpSpy = sinon.spy(http, 'request');
    callback();
  },

  tearDown: function(callback) {
    http.request.restore();
    callback();
  },

  testValidMeasurementNoTags: function(test) {
    test.expect(4);
    let metrics = {gauges: {my_gauge: 1}};
    this.apiServer.post('/v1/measurements')
             .reply(200, (uri, requestBody) => {
                let measurement = requestBody.measurements[0];
                test.ok(requestBody);
                test.equal(measurement.name, 'my_gauge');
                test.equal(measurement.value, 1);
                test.deepEqual(measurement.tags, {});
                test.done();
             });

    this.emitter.emit('flush', 123, metrics);
  },

  testValidMeasurementSingleTag: function(test) {
    test.expect(4);
    let metrics = {gauges: {'my_gauge#foo=bar': 1}};
    this.apiServer.post('/v1/measurements')
             .reply(200, (uri, requestBody) => {
                let measurement = requestBody.measurements[0];
                test.ok(requestBody);
                test.equal(measurement.name, 'my_gauge');
                test.equal(measurement.value, 1);
                test.deepEqual(measurement.tags, {foo: 'bar'});
                test.done();
             });

    this.emitter.emit('flush', 123, metrics);
  },

  testValidMeasurementMultipleTags: function(test) {
    test.expect(4);
    let metrics = {gauges: {'my_gauge#foo=bar,biz=baz': 1}};
    this.apiServer.post('/v1/measurements')
             .reply(200, (uri, requestBody) => {
                let measurement = requestBody.measurements[0];
                test.ok(requestBody);
                test.equal(measurement.name, 'my_gauge');
                test.equal(measurement.value, 1);
                test.deepEqual(measurement.tags, {
                  foo: 'bar',
                  biz: 'baz',
                });
                test.done();
             });

    this.emitter.emit('flush', 123, metrics);
  },

  testTimerWithOneMeasurement: function(test) {
    test.expect(8);
    let metrics = {
      timers: {
        'my_timer#tag=foo': [
          41,
        ],
      },
      timer_data: {'my_timer#tag=foo': null},
    };
    this.apiServer.post('/v1/measurements')
      .reply(200, (uri, requestBody) => {
        let measurement = requestBody.measurements[0];
        test.ok(measurement);
        test.equal(measurement.name, 'my_timer');
        test.equal(measurement.value, undefined);
        test.equal(measurement.stddev_m2, 0);
        test.equal(measurement.min, 41);
        test.equal(measurement.max, 41);
        test.equal(measurement.sum, 41);
        test.deepEqual(measurement.tags, {tag: 'foo'});
        test.done();
      });

    this.emitter.emit('flush', 123, metrics);
  },


  testLargeTimersPercentiles: function(test) {
    test.expect(18);
    let metrics = {
      timers: {
        'my_timer#tag=foo': [
          1,
          4,
          7,
          10,
          13,
          16,
          19,
          22,
          25,
          29,
          33,
          37,
          40,
          45,
          50,
          56,
          62,
          69,
        ],
      },
      timer_data: {'my_timer#tag=foo': null},
      pctThreshold: {90: 90},
    };
    this.apiServer.post('/v1/measurements')
      .reply(200, (uri, requestBody) => {
        let hundredth = requestBody.measurements[0];
        test.ok(hundredth);
        test.equal(hundredth.name, 'my_timer');
        test.equal(hundredth.value, undefined);
        test.equal(hundredth.min, 1);
        test.equal(hundredth.count, 18);
        test.equal(hundredth.stddev_m2, 20.502191816511857);
        test.equal(hundredth.max, 69);
        test.equal(hundredth.sum, 538);
        test.deepEqual(hundredth.tags, {tag: 'foo'});

        let measurement = requestBody.measurements[1];
        test.ok(measurement);
        test.equal(measurement.name, 'my_timer.90');
        test.equal(measurement.value, undefined);
        test.equal(measurement.min, 1);
        test.equal(measurement.count, 16);
        test.equal(measurement.stddev_m2, 16.86799237214277);
        test.equal(measurement.max, 56);
        test.equal(measurement.sum, 407);
        test.deepEqual(measurement.tags, {tag: 'foo'});
        test.done();
      });

    this.emitter.emit('flush', 123, metrics);
  },

  testLargeTimers: function(test) {
    test.expect(9);
    let metrics = {
      timers: {
        'my_timer#tag=foo': [
          1,
          4,
          7,
          10,
          13,
          16,
          19,
          22,
          25,
          29,
          33,
          37,
          40,
          45,
          50,
          56,
          62,
          69,
        ],
      },
      timer_data: {'my_timer#tag=foo': null},
    };
    this.apiServer.post('/v1/measurements')
      .reply(200, (uri, requestBody) => {
        let measurement = requestBody.measurements[0];
        test.ok(measurement);
        test.equal(measurement.name, 'my_timer');
        test.equal(measurement.value, undefined);
        test.equal(measurement.min, 1);
        test.equal(measurement.count, 18);
        test.equal(measurement.stddev_m2, 20.502191816511857);
        test.equal(measurement.max, 69);
        test.equal(measurement.sum, 538);
        test.deepEqual(measurement.tags, {tag: 'foo'});
        test.done();
      });

    this.emitter.emit('flush', 123, metrics);
  },

  testTimers: function(test) {
    test.expect(7);
    let metrics = {
      timers: {
        'my_timer#tag=foo': [
          41,
          73.5,
        ],
      },
      timer_data: {'my_timer#tag=foo': null},
    };
    this.apiServer.post('/v1/measurements')
             .reply(200, (uri, requestBody) => {
                let measurement = requestBody.measurements[0];
                test.ok(measurement);
                test.equal(measurement.name, 'my_timer');
                test.equal(measurement.value, undefined);
                test.equal(measurement.min, 41);
                test.equal(measurement.max, 73.5);
                test.equal(measurement.sum, 114.5);
                test.deepEqual(measurement.tags, {tag: 'foo'});
                test.done();
             });

    this.emitter.emit('flush', 123, metrics);
  },

  testTimersPercentiles: function(test) {
    test.expect(14);
    let metrics = {
      timers: {
        'my_timer#tag=foo': [10],
      },
      timer_data: {'my_timer#tag=foo': null},
      pctThreshold: {99: 99},
    };
    this.apiServer.post('/v1/measurements')
             .reply(200, (uri, requestBody) => {
                let hundredth = requestBody.measurements[0];
                test.ok(hundredth);
                test.equal(hundredth.name, 'my_timer');
                test.equal(hundredth.value, undefined);
                test.equal(hundredth.min, 10);
                test.equal(hundredth.max, 10);
                test.equal(hundredth.sum, 10);
                test.deepEqual(hundredth.tags, {tag: 'foo'});

                let measurement = requestBody.measurements[1];
                test.ok(measurement);
                test.equal(measurement.name, 'my_timer.99');
                test.equal(measurement.value, undefined);
                test.equal(measurement.min, 10);
                test.equal(measurement.max, 10);
                test.equal(measurement.sum, 10);
                test.deepEqual(measurement.tags, {tag: 'foo'});
                test.done();
             });

    this.emitter.emit('flush', 123, metrics);
  },

  testIgnoreBrokenMetrics: function(test) {
    test.expect(3);
    let metrics = {
      gauges: {
        cool_gauge: 123,
        bad_counter: 321,
      },
    };
    let errors = {errors: {params: {type: ['\'bad_counter\'' + ' is a counter, but was' + ' submitted as different type']}}};

    this.apiServer.post('/v1/measurements')
                  .reply(400, JSON.stringify(errors));

    this.emitter.emit('flush', 123, metrics);

    // Similuate another flush...
    setTimeout(() => {
      this.apiServer.post('/v1/measurements')
               .reply(200, (uri, requestBody) => {
                 let measurements = requestBody.measurements;
                 let gaugeNames = measurements.map((gauge) => gauge.name);
                 test.equal(requestBody.measurements.length, 1);
                 test.equal(gaugeNames.indexOf('cool_gauge'), 0);
                 test.equal(gaugeNames.indexOf('bad_counter'), -1);
                 test.done();
               });

      this.emitter.emit('flush', 123, metrics);
    }, 500);
  },

  testMaxBatchSize: function(test) {
    test.expect(2);
    var gauges = {};
    for (var i = 0; i < 500; i++) {
      var key = 'gauge' + i;
      gauges[key] = 1;
    }
    var metrics = {gauges: gauges};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    test.ok(requestBody.measurements);
                    test.equal(requestBody.measurements.length, 500);
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },

  testBatchProperRequestCount: function(test) {
    test.expect(3);
    var gauges = {};
    for (var i = 0; i < 500; i++) {
      var key = 'gauge' + i;
      gauges[key] = 1;
    }
    var metrics = {gauges: gauges};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    test.ok(requestBody.measurements);
                  });

    this.emitter.emit('flush', 123, metrics);

    // Let some time pass...
    setTimeout(() => {
      // There should have ever been one submission because we hit our maxBatchSize
      test.ok(this.httpSpy.calledOnce);

      // Try with a bigger batch...
      for (var i = 0; i < 1500; i++) {
        var key = 'gauge' + i;
        gauges[key] = 1;
      }
      metrics = {gauges: gauges};
      // Reset the spy
      this.httpSpy.reset();

      // Flush
      this.emitter.emit('flush', 123, metrics);

      // Let some time pass...
      setTimeout(() => {
        // One request, per batch of 500 metrics....
        test.ok(this.httpSpy.calledThrice);
        test.done();
      });
    }, 500);
  },

  testValidMeasurementTopLevelTag: function(test) {
    config.librato.host = '127.0.0.1';
    config.librato.tags = {test: true};
    librato.init(null, config, this.emitter);

    test.expect(5);
    let metrics = {gauges: {'my_gauge#foo=bar': 1}};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    // Top-level tags
                    test.deepEqual(requestBody.tags, {test: true, host: '127.0.0.1'});

                    let measurement = requestBody.measurements[0];
                    test.ok(requestBody);
                    test.equal(measurement.name, 'my_gauge');
                    test.equal(measurement.value, 1);
                    test.deepEqual(measurement.tags, {foo: 'bar'});
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },
};

module.exports.legacy = {
  setUp: function(callback) {
    config.librato.writeToLegacy = true;
    config.librato.countersAsGauges = false;
    this.emitter = new events.EventEmitter();

    this.apiServer = nock('http://127.0.0.1:36001')
                         .defaultReplyHeaders({'Content-Type': 'application/json'});

    librato.init(null, config, this.emitter);
    callback();
  },

  tearDown: function(callback) {
    callback();
  },

  testGauges: function(test) {
    test.expect(7);
    let metrics = {gauges: {my_gauge: 1}};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    let measurement = requestBody.measurements[0];
                    test.ok(requestBody);
                    test.equal(measurement.name, 'my_gauge');
                    test.equal(measurement.value, 1);
                    test.deepEqual(measurement.tags, {});
                  });

    this.apiServer.post('/v1/metrics')
                  .reply(200, (uri, requestBody) => {
                    let gauge = requestBody.gauges[0];
                    test.ok(requestBody);
                    test.equal(gauge.name, 'my_gauge');
                    test.equal(gauge.value, 1);
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },

  testCounters: function(test) {
    test.expect(7);
    let metrics = {counters: {my_counter: 1}};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    let measurement = requestBody.measurements[0];
                    test.ok(requestBody);
                    test.equal(measurement.name, 'my_counter');
                    test.equal(measurement.value, 1);
                    test.deepEqual(measurement.tags, {});
                  });

    this.apiServer.post('/v1/metrics')
                  .reply(200, (uri, requestBody) => {
                    let counter = requestBody.counters[0];
                    test.ok(requestBody);
                    test.equal(counter.name, 'my_counter');
                    test.equal(counter.value, 1);
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },

  testSource: function(test) {
    config.librato.source = 'localhost';
    librato.init(null, config, this.emitter);

    test.expect(9);
    let metrics = {gauges: {my_gauge: 1}};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    // No top level source
                    test.equal(requestBody.source, undefined);

                    let measurement = requestBody.measurements[0];
                    test.ok(requestBody);
                    test.equal(measurement.name, 'my_gauge');
                    test.equal(measurement.value, 1);
                    test.deepEqual(measurement.tags, {source: 'localhost'});
                  });

    this.apiServer.post('/v1/metrics')
                  .reply(200, (uri, requestBody) => {
                    let gauge = requestBody.gauges[0];
                    test.ok(requestBody);
                    test.equal(gauge.name, 'my_gauge');
                    test.equal(gauge.value, 1);
                    test.equal(gauge.source, 'localhost');
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },

  testSourceRegex: function(test) {
    config.librato.sourceRegex = /^(.*?)--/;
    librato.init(null, config, this.emitter);

    test.expect(9);
    let metrics = {gauges: {'rails-application--my_gauge': 1}};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    let measurement = requestBody.measurements[0];
                    test.ok(requestBody);
                    // no source when using the measurements api
                    test.equal(measurement.source, undefined);
                    test.equal(measurement.name, 'my_gauge');
                    test.equal(measurement.value, 1);
                    test.deepEqual(measurement.tags, {source: 'rails-application'});
                  });

    this.apiServer.post('/v1/metrics')
                  .reply(200, (uri, requestBody) => {
                    let gauge = requestBody.gauges[0];
                    test.ok(requestBody);
                    test.equal(gauge.name, 'my_gauge');
                    test.equal(gauge.value, 1);
                    test.equal(gauge.source, 'rails-application');
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },

  testGlobalPrefix: function(test) {
    config.librato.sourceRegex = /^(.*?)--/;
    config.librato.globalPrefix = 'global.prefix';
    librato.init(null, config, this.emitter);

    test.expect(6);
    let metrics = {gauges: {'rails-application--my_gauge': 1}};
    this.apiServer.post('/v1/measurements')
                  .reply(200, (uri, requestBody) => {
                    let measurement = requestBody.measurements[0];
                    test.ok(requestBody);
                    test.equal(measurement.name.startsWith('global.prefix'), true);
                    test.deepEqual(measurement.tags, {source: 'rails-application'});
                  });

    this.apiServer.post('/v1/metrics')
                  .reply(200, (uri, requestBody) => {
                    let gauge = requestBody.gauges[0];
                    test.ok(requestBody);
                    test.equal(gauge.name.startsWith('global.prefix'), true);
                    test.equal(gauge.source, 'rails-application');
                    test.done();
                  });

    this.emitter.emit('flush', 123, metrics);
  },
};
