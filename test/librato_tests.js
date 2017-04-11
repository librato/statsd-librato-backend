'use strict';

const events = require('events');
const serverPort = 36001;
const librato = require('../lib/librato.js');
const nock = require('nock');

const config = {
  debug: false,
  librato: {
    email: '-@-',
    token: '-',
    api: 'http://127.0.0.1:' + serverPort,
    writeToLegacy: false,
  },
};

module.exports = {
  setUp: function(callback) {
    this.emitter = new events.EventEmitter();

    this.apiServer = nock('http://127.0.0.1:36001')
                         .defaultReplyHeaders({'Content-Type': 'application/json'});

    librato.init(null, config, this.emitter);
    callback();
  },

  tearDown: function(callback) {
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
};
