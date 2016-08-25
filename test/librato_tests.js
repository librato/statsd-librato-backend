var librato_init = require('../lib/librato.js').init,
    http = require('http'),
    events = require('events'),
    server_port = 36001;

module.exports = {
  setUp: function(callback) {
    this.server = http.createServer();
    this.server.listen(server_port, '127.0.0.1', function() {
      callback();
    });
  },

  tearDown: function (callback) {
    this.server.close(function() {
      callback();
    });
  },

  testIgnoreBrokenMetrics: function(test) {
    var emitter = new events.EventEmitter(),
        server = this.server;
    var metrics = {
          gauges: {
            cool_gauge: 123,
            bad_counter: 321
          }
        };
    var api_mock = function (reject_metric) {
      return function(req, res) {
        var data = '';
        req.on('data', function(chunk) {
          data += chunk;
        });
        req.on('end', function() {
          var body = JSON.parse(data),
              gauges = {};
              
          for (var k in body.measurements) {
            gauges[body.measurements[k].name] = body.measurements[k].value;
          }
          if (reject_metric) {
            test.ok(gauges.bad_counter);
            test.ok(gauges.cool_gauge);

            res.writeHead(
              400,
              {'content-type': 'application/json'}
            );
            res.end(JSON.stringify({
              errors: {
                params: {
                  type: [
                    "'bad_counter'" +
                      " is a counter, but was" +
                      " submitted as different type"
                  ]
                }
              }
            }));
            setTimeout(function() {
              server.once('request', api_mock(false));
              emitter.emit('flush', 123, metrics);
            }, 100);
            
          } else {
            res.writeHead(200, {});
            res.end('');
            

            test.strictEqual(gauges.bad_counter, undefined);
            test.ok(gauges.cool_gauge);

            test.done();
          }
        });
      };
    }

    librato_init(null, {
      debug: false,
      librato: {
        email: '-@-',
        token: '-',
        api: 'http://127.0.0.1:' + server_port,
      }
    }, emitter);

    server.once('request', api_mock(true));
    emitter.emit('flush', 123, metrics);
  }
};
