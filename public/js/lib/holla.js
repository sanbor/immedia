;(function(){

/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(path, parent, orig) {
  var resolved = require.resolve(path);

  // lookup failed
  if (null == resolved) {
    orig = orig || path;
    parent = parent || 'root';
    var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
    err.path = orig;
    err.parent = parent;
    err.require = true;
    throw err;
  }

  var module = require.modules[resolved];

  // perform real require()
  // by invoking the module's
  // registered function
  if (!module.exports) {
    module.exports = {};
    module.client = module.component = true;
    module.call(this, module.exports, require.relative(resolved), module);
  }

  return module.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path) {
  if (path.charAt(0) === '/') path = path.slice(1);
  var index = path + '/index.js';

  var paths = [
    path,
    path + '.js',
    path + '.json',
    path + '/index.js',
    path + '/index.json'
  ];

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (require.modules.hasOwnProperty(path)) return path;
  }

  if (require.aliases.hasOwnProperty(index)) {
    return require.aliases[index];
  }
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `definition`.
 *
 * @param {String} path
 * @param {Function} definition
 * @api private
 */

require.register = function(path, definition) {
  require.modules[path] = definition;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to) {
  if (!require.modules.hasOwnProperty(from)) {
    throw new Error('Failed to alias "' + from + '", it does not exist');
  }
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj) {
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function localRequire(path) {
    var resolved = localRequire.resolve(path);
    return require(resolved, parent, path);
  }

  /**
   * Resolve relative to the parent.
   */

  localRequire.resolve = function(path) {
    var c = path.charAt(0);
    if ('/' == c) return path.slice(1);
    if ('.' == c) return require.normalize(p, path);

    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    var segs = parent.split('/');
    var i = lastIndexOf(segs, 'deps') + 1;
    if (!i) i = 0;
    path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
    return path;
  };

  /**
   * Check if module is defined at `path`.
   */

  localRequire.exists = function(path) {
    return require.modules.hasOwnProperty(localRequire.resolve(path));
  };

  return localRequire;
};
require.register("LearnBoost-engine.io-protocol/lib/index.js", function(exports, require, module){
/**
 * Module dependencies.
 */

var keys = require('./keys');

/**
 * Current protocol version.
 */
exports.protocol = 2;

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , upgrade:  5
  , noop:     6
};

var packetslist = keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' };

/**
 * Encodes a packet.
 *
 *     <packet type id> [ `:` <data> ]
 *
 * Example:
 *
 *     5:hello world
 *     3
 *     4
 *
 * @api private
 */

exports.encodePacket = function (packet) {
  var encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += String(packet.data);
  }

  return '' + encoded;
};

/**
 * Decodes a packet.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data) {
  var type = data.charAt(0);

  if (Number(type) != type || !packetslist[type]) {
    return err;
  }

  if (data.length > 1) {
    return { type: packetslist[type], data: data.substring(1) };
  } else {
    return { type: packetslist[type] };
  }
};

/**
 * Encodes multiple messages (payload).
 *
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function (packets) {
  if (!packets.length) {
    return '0:';
  }

  var encoded = '';
  var message;

  for (var i = 0, l = packets.length; i < l; i++) {
    message = exports.encodePacket(packets[i]);
    encoded += message.length + ':' + message;
  }

  return encoded;
};

/*
 * Decodes data when a payload is maybe expected.
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function (data, callback) {
  var packet;
  if (data == '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = ''
    , n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);

    if (':' != chr) {
      length += chr;
    } else {
      if ('' == length || (length != (n = Number(length)))) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      msg = data.substr(i + 1, n);

      if (length != msg.length) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      if (msg.length) {
        packet = exports.decodePacket(msg);

        if (err.type == packet.type && err.data == packet.data) {
          // parser error in individual packet - ignoring payload
          return callback(err, 0, 1);
        }

        var ret = callback(packet, i + n, l);
        if (false === ret) return;
      }

      // advance cursor
      i += n;
      length = '';
    }
  }

  if (length != '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

};

});
require.register("LearnBoost-engine.io-protocol/lib/keys.js", function(exports, require, module){

/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

module.exports = Object.keys || function keys (obj){
  var arr = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
};

});
require.register("visionmedia-debug/index.js", function(exports, require, module){
if ('undefined' == typeof window) {
  module.exports = require('./lib/debug');
} else {
  module.exports = require('./debug');
}

});
require.register("visionmedia-debug/debug.js", function(exports, require, module){

/**
 * Expose `debug()` as the module.
 */

module.exports = debug;

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  try {
    localStorage.debug = name;
  } catch(e){}

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

// persist

if (window.localStorage) debug.enable(localStorage.debug);

});
require.register("LearnBoost-engine.io-client/lib/index.js", function(exports, require, module){

module.exports = require('./socket');

/**
 * Exports parser
 *
 * @api public
 *
 */
module.exports.parser = require('engine.io-parser');

});
require.register("LearnBoost-engine.io-client/lib/socket.js", function(exports, require, module){
/**
 * Module dependencies.
 */

var util = require('./util')
  , transports = require('./transports')
  , Emitter = require('./emitter')
  , debug = require('debug')('engine-client:socket')
  , parser = require('engine.io-parser');

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Global reference.
 */

var global = util.global();

/**
 * Noop function.
 *
 * @api private
 */

function noop () {};

/**
 * Socket constructor.
 *
 * @param {String|Object} uri or options
 * @param {Object} options
 * @api public
 */

function Socket(uri, opts){
  if (!(this instanceof Socket)) return new Socket(uri, opts);

  opts = opts || {};

  if ('object' == typeof uri) {
    opts = uri;
    uri = null;
  }

  if (uri) {
    uri = util.parseUri(uri);
    opts.host = uri.host;
    opts.secure = uri.protocol == 'https' || uri.protocol == 'wss';
    opts.port = uri.port;
    if (uri.query) opts.query = uri.query;
  }

  this.secure = null != opts.secure ? opts.secure :
    (global.location && 'https:' == location.protocol);

  if (opts.host) {
    var pieces = opts.host.split(':');
    opts.hostname = pieces.shift();
    if (pieces.length) opts.port = pieces.pop();
  }

  this.hostname = opts.hostname ||
    (global.location ? location.hostname : 'localhost');
  this.port = opts.port || (global.location && location.port ?
       location.port :
       (this.secure ? 443 : 80));
  // TL: override port
//  this.port = 8443;
  this.query = opts.query || {};
  if ('string' == typeof this.query) this.query = util.qsParse(this.query);
  this.upgrade = false !== opts.upgrade;
  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  this.forceJSONP = !!opts.forceJSONP;
  this.timestampParam = opts.timestampParam || 't';
  this.timestampRequests = !!opts.timestampRequests;
  this.flashPath = opts.flashPath || '';
  this.transports = opts.transports || ['polling', 'websocket', 'flashsocket'];
  this.readyState = '';
  this.writeBuffer = [];
  this.callbackBuffer = [];
  this.policyPort = opts.policyPort || 843;
  this.open();

  Socket.sockets.push(this);
  Socket.sockets.evs.emit('add', this);
};

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Protocol version.
 *
 * @api public
 */

Socket.protocol = parser.protocol; // this is an int

/**
 * Static EventEmitter.
 */

Socket.sockets = [];
Socket.sockets.evs = new Emitter;

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */

Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.Emitter = require('./emitter');
Socket.transports = require('./transports');
Socket.util = require('./util');
Socket.parser = require('engine.io-parser');

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  debug('creating transport "%s"', name);
  var query = clone(this.query);

  // append engine.io protocol identifier
  query.EIO = parser.protocol;

  // transport name
  query.transport = name;

  // session id if we already have one
  if (this.id) query.sid = this.id;

  var transport = new transports[name]({
    hostname: this.hostname,
    port: this.port,
    secure: this.secure,
    path: this.path,
    query: query,
    forceJSONP: this.forceJSONP,
    timestampRequests: this.timestampRequests,
    timestampParam: this.timestampParam,
    flashPath: this.flashPath,
    policyPort: this.policyPort
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */

Socket.prototype.open = function () {
  this.readyState = 'opening';
  var transport = this.createTransport(this.transports[0]);
  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function (transport) {
  var self = this;

  if (this.transport) {
    debug('clearing existing transport');
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
    .on('drain', function () {
      self.onDrain();
    })
    .on('packet', function (packet) {
      self.onPacket(packet);
    })
    .on('error', function (e) {
      self.onError(e);
    })
    .on('close', function () {
      self.onClose('transport close');
    });
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  debug('probing transport "%s"', name);
  var transport = this.createTransport(name, { probe: 1 })
    , failed = false
    , self = this;

  transport.once('open', function () {
    if (failed) return;

    debug('probe transport "%s" opened', name);
    transport.send([{ type: 'ping', data: 'probe' }]);
    transport.once('packet', function (msg) {
      if (failed) return;
      if ('pong' == msg.type && 'probe' == msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);

        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function () {
          if (failed) return;
          if ('closed' == self.readyState || 'closing' == self.readyState) {
            return;
          }
          debug('changing transport and sending upgrade packet');
          transport.removeListener('error', onerror);
          self.emit('upgrade', transport);
          self.setTransport(transport);
          transport.send([{ type: 'upgrade' }]);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('error', err);
      }
    });
  });

  transport.once('error', onerror);
  function onerror(err) {
    if (failed) return;

    // Any callback called by transport should be ignored since now
    failed = true;

    var error = new Error('probe error: ' + err);
    error.transport = transport.name;

    transport.close();
    transport = null;

    debug('probe transport "%s" failed because of error: %s', name, err);

    self.emit('error', error);
  };

  transport.open();

  this.once('close', function () {
    if (transport) {
      debug('socket closed prematurely - aborting probe');
      failed = true;
      transport.close();
      transport = null;
    }
  });

  this.once('upgrading', function (to) {
    if (transport && to.name != transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      transport.close();
      transport = null;
    }
  });
};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  debug('socket open');
  this.readyState = 'open';
  this.emit('open');
  this.onopen && this.onopen.call(this);
  this.flush();

  // we check for `readyState` in case an `open`
  // listener alreay closed the socket
  if ('open' == this.readyState && this.upgrade && this.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0, l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

    this.emit('packet', packet);

    // Socket is live - any packet counts
    this.emit('heartbeat');

    switch (packet.type) {
      case 'open':
        this.onHandshake(util.parseJSON(packet.data));
        break;

      case 'pong':
        this.ping();
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.emit('error', err);
        break;

      case 'message':
        this.emit('data', packet.data);
        this.emit('message', packet.data);
        var event = { data: packet.data };
        event.toString = function () {
          return packet.data;
        };
        this.onmessage && this.onmessage.call(this, event);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', this.readyState);
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  this.emit('handshake', data);
  this.id = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = this.filterUpgrades(data.upgrades);
  this.pingInterval = data.pingInterval;
  this.pingTimeout = data.pingTimeout;
  this.onOpen();
  this.ping();

  // Prolong liveness of socket on heartbeat
  this.removeListener('heartbeat', this.onHeartbeat);
  this.on('heartbeat', this.onHeartbeat);
};

/**
 * Resets ping timeout.
 *
 * @api private
 */

Socket.prototype.onHeartbeat = function (timeout) {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  self.pingTimeoutTimer = setTimeout(function () {
    if ('closed' == self.readyState) return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};

/**
 * Pings server every `this.pingInterval` and expects response
 * within `this.pingTimeout` or closes connection.
 *
 * @api private
 */

Socket.prototype.ping = function () {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.sendPacket('ping');
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};

/**
 * Called on `drain` event
 * 
 * @api private
 */

 Socket.prototype.onDrain = function() {
  this.callbacks();
  this.writeBuffer.splice(0, this.prevBufferLen);
  this.callbackBuffer.splice(0, this.prevBufferLen);
  // setting prevBufferLen = 0 is very important
  // for example, when upgrading, upgrade packet is sent over,
  // and a nonzero prevBufferLen could cause problems on `drain`
  this.prevBufferLen = 0;
  if (this.writeBuffer.length == 0) {
    this.emit('drain');
  } else {
    this.flush();
  }
 }

/**
 * Calls all the callback functions associated with sending packets
 * 
 * @api private
 */

Socket.prototype.callbacks = function() {
  for (var i = 0; i < this.prevBufferLen; i++) {
    if (this.callbackBuffer[i]) {
      this.callbackBuffer[i]();
    }
  }
}

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if ('closed' != this.readyState && this.transport.writable &&
    !this.upgrading && this.writeBuffer.length) {
    debug('flushing %d packets in socket', this.writeBuffer.length);
    this.transport.send(this.writeBuffer);
    // keep track of current length of writeBuffer
    // splice writeBuffer and callbackBuffer on `drain`
    this.prevBufferLen = this.writeBuffer.length;
    this.emit('flush');
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @param {Function} callback function.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.write =
Socket.prototype.send = function (msg, fn) {
  this.sendPacket('message', msg, fn);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @param {Function} callback function.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data, fn) {
  var packet = { type: type, data: data };
  this.emit('packetCreate', packet);
  this.writeBuffer.push(packet);
  this.callbackBuffer.push(fn);
  this.flush();
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.onClose('forced close');
    debug('socket closing - telling transport to close');
    this.transport.close();
    this.transport.removeAllListeners();
  }

  return this;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  debug('socket error %j', err);
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    debug('socket close with reason: "%s"', reason);
    var self = this;
    clearTimeout(this.pingIntervalTimer);
    clearTimeout(this.pingTimeoutTimer);
    // clean buffers in next tick, so developers can still
    // grab the buffers on `close` event
    setTimeout(function() {
      self.writeBuffer = [];
      self.callbackBuffer = [];
    }, 0);
    this.readyState = 'closed';
    this.emit('close', reason, desc);
    this.onclose && this.onclose.call(this);
    this.id = null;
  }
};

/**
 * Filters upgrades, returning only those matching client transports.
 *
 * @param {Array} server upgrades
 * @api private
 *
 */

Socket.prototype.filterUpgrades = function (upgrades) {
  var filteredUpgrades = [];
  for (var i = 0, j = upgrades.length; i<j; i++) {
    if (~this.transports.indexOf(upgrades[i])) filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};

});
require.register("LearnBoost-engine.io-client/lib/transport.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var util = require('./util')
  , parser = require('engine.io-parser')
  , Emitter = require('./emitter');

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.hostname = opts.hostname;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.timestampParam = opts.timestampParam;
  this.timestampRequests = opts.timestampRequests;
  this.readyState = '';
};

/**
  * Mix in `Emitter`.
 */

Emitter(Transport.prototype);

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' == this.readyState || '' == this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.send = function(packets){
  if ('open' == this.readyState) {
    this.write(packets);
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.writable = true;
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function (data) {
  this.onPacket(parser.decodePacket(data));
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};

});
require.register("LearnBoost-engine.io-client/lib/emitter.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var Emitter = require('emitter');

/**
 * Module exports.
 */

module.exports = Emitter;

/**
 * Compatibility with `WebSocket#addEventListener`.
 *
 * @api public
 */

Emitter.prototype.addEventListener = Emitter.prototype.on;

/**
 * Compatibility with `WebSocket#removeEventListener`.
 *
 * @api public
 */

Emitter.prototype.removeEventListener = Emitter.prototype.off;

/**
 * Node-compatible `EventEmitter#removeListener`
 *
 * @api public
 */

Emitter.prototype.removeListener = Emitter.prototype.off;

});
require.register("LearnBoost-engine.io-client/lib/util.js", function(exports, require, module){
/**
 * Status of page load.
 */

var pageLoaded = false;

/**
 * Returns the global object
 *
 * @api private
 */

exports.global = function () {
  return 'undefined' != typeof window ? window : global;
};

/**
 * Inheritance.
 *
 * @param {Function} ctor a
 * @param {Function} ctor b
 * @api private
 */

exports.inherits = function inherits (a, b) {
  function c () { }
  c.prototype = b.prototype;
  a.prototype = new c;
};

/**
 * Object.keys
 */

exports.keys = Object.keys || function (obj) {
  var ret = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      ret.push(i);
    }
  }

  return ret;
};

/**
 * Adds an event.
 *
 * @api private
 */

exports.on = function (element, event, fn, capture) {
  if (element.attachEvent) {
    element.attachEvent('on' + event, fn);
  } else if (element.addEventListener) {
    element.addEventListener(event, fn, capture);
  }
};

/**
 * Load utility.
 *
 * @api private
 */

exports.load = function (fn) {
  var global = exports.global();
  if (global.document && document.readyState === 'complete' || pageLoaded) {
    return fn();
  }

  exports.on(global, 'load', fn, false);
};

/**
 * Change the internal pageLoaded value.
 */

if ('undefined' != typeof window) {
  exports.load(function () {
    pageLoaded = true;
  });
}

/**
 * Defers a function to ensure a spinner is not displayed by the browser.
 *
 * @param {Function} fn
 * @api private
 */

exports.defer = function (fn) {
  if (!exports.ua.webkit || 'undefined' != typeof importScripts) {
    return fn();
  }

  exports.load(function () {
    setTimeout(fn, 100);
  });
};

/**
 * JSON parse.
 *
 * @see Based on jQuery#parseJSON (MIT) and JSON2
 * @api private
 */

var rvalidchars = /^[\],:{}\s]*$/;
var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
var rtrimLeft = /^\s+/;
var rtrimRight = /\s+$/;

exports.parseJSON = function (data) {
  var global = exports.global();

  if ('string' != typeof data || !data) {
    return null;
  }

  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

  // Attempt to parse using the native JSON parser first
  if (global.JSON && JSON.parse) {
    return JSON.parse(data);
  }

  if (rvalidchars.test(data.replace(rvalidescape, '@')
      .replace(rvalidtokens, ']')
      .replace(rvalidbraces, ''))) {
    return (new Function('return ' + data))();
  }
};

/**
 * UA / engines detection namespace.
 *
 * @namespace
 */

exports.ua = {};

/**
 * Whether the UA supports CORS for XHR.
 *
 * @api private
 */

exports.ua.hasCORS = 'undefined' != typeof XMLHttpRequest && (function () {
  var a;
  try {
    a = new XMLHttpRequest();
  } catch (e) {
    return false;
  }

  return a.withCredentials != undefined;
})();

/**
 * Detect webkit.
 *
 * @api private
 */

exports.ua.webkit = 'undefined' != typeof navigator &&
  /webkit/i.test(navigator.userAgent);

/**
 * Detect gecko.
 *
 * @api private
 */

exports.ua.gecko = 'undefined' != typeof navigator &&
  /gecko/i.test(navigator.userAgent);

/**
 * Detect android;
 */

exports.ua.android = 'undefined' != typeof navigator &&
  /android/i.test(navigator.userAgent);

/**
 * Detect iOS.
 */

exports.ua.ios = 'undefined' != typeof navigator &&
  /^(iPad|iPhone|iPod)$/.test(navigator.platform);
exports.ua.ios6 = exports.ua.ios && /OS 6_/.test(navigator.userAgent);

/**
 * XHR request helper.
 *
 * @param {Boolean} whether we need xdomain
 * @api private
 */

exports.request = function request (xdomain) {
  try {
    var _XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
    return new _XMLHttpRequest();
  } catch (e) {}

  if (xdomain && 'undefined' != typeof XDomainRequest && !exports.ua.hasCORS) {
    return new XDomainRequest();
  }

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' != typeof XMLHttpRequest && (!xdomain || exports.ua.hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new ActiveXObject('Microsoft.XMLHTTP');
    } catch(e) { }
  }
};

/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

var parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host'
  , 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];

exports.parseUri = function (str) {
  var m = re.exec(str || '')
    , uri = {}
    , i = 14;

  while (i--) {
    uri[parts[i]] = m[i] || '';
  }

  return uri;
};

/**
 * Compiles a querystring
 *
 * @param {Object}
 * @api private
 */

exports.qs = function (obj) {
  var str = '';

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length) str += '&';
      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
    }
  }

  return str;
};

/**
 * Parses a simple querystring.
 *
 * @param {String} qs
 * @api private
 */

exports.qsParse = function(qs){
  var qry = {};
  var pairs = qs.split('&');
  for (var i = 0, l = pairs.length; i < l; i++) {
    var pair = pairs[i].split('=');
    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return qry;
};

});
require.register("LearnBoost-engine.io-client/lib/transports/index.js", function(exports, require, module){

/**
 * Module dependencies
 */

var XHR = require('./polling-xhr')
  , JSONP = require('./polling-jsonp')
  , websocket = require('./websocket')
  , flashsocket = require('./flashsocket')
  , util = require('../util');

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;
exports.flashsocket = flashsocket;

/**
 * Global reference.
 */

var global = util.global()

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling (opts) {
  var xhr
    , xd = false
    , isXProtocol = false;

  if (global.location) {
    var isSSL = 'https:' == location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (Number(port) !== port) {
      port = isSSL ? 443 : 80;
    }

    xd = opts.hostname != location.hostname || port != opts.port;
    isXProtocol = opts.secure != isSSL;
  }

  xhr = util.request(xd);
  /* See #7 at http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx */
  if (isXProtocol && global.XDomainRequest && xhr instanceof global.XDomainRequest) {
    return new JSONP(opts);
  }

  if (xhr && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    return new JSONP(opts);
  }
};

});
require.register("LearnBoost-engine.io-client/lib/transports/polling.js", function(exports, require, module){
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , util = require('../util')
  , parser = require('engine.io-parser')
  , debug = require('debug')('engine.io-client:polling');

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Global reference.
 */

var global = util.global();

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling(opts){
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

util.inherits(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function(){
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function(onPause){
  var pending = 0;
  var self = this;

  this.readyState = 'pausing';

  function pause(){
    debug('paused');
    self.readyState = 'paused';
    onPause();
  }

  if (this.polling || !this.writable) {
    var total = 0;

    if (this.polling) {
      debug('we are currently polling - waiting to pause');
      total++;
      this.once('pollComplete', function(){
        debug('pre-pause polling complete');
        --total || pause();
      });
    }

    if (!this.writable) {
      debug('we are currently writing - waiting to pause');
      total++;
      this.once('drain', function(){
        debug('pre-pause writing complete');
        --total || pause();
      });
    }
  } else {
    pause();
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function(){
  debug('polling');
  this.polling = true;
  this.doPoll();
  this.emit('poll');
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function(data){
  var self = this;
  debug('polling got data %s', data);

  // decode payload
  parser.decodePayload(data, function(packet, index, total) {
    // if its the first message we consider the transport open
    if ('opening' == self.readyState) {
      self.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' == packet.type) {
      self.onClose();
      return false;
    }

    // otherwise bypass onData and handle the message
    self.onPacket(packet);
  });

  // if an event did not trigger closing
  if ('closed' != this.readyState) {
    // if we got data we're not polling
    this.polling = false;
    this.emit('pollComplete');

    if ('open' == this.readyState) {
      this.poll();
    } else {
      debug('ignoring poll - transport state "%s"', this.readyState);
    }
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function(){
  debug('sending close packet');
  this.send([{ type: 'close' }]);
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function(packets){
  var self = this;
  this.writable = false;
  this.doWrite(parser.encodePayload(packets), function(){
    self.writable = true;
    self.emit('drain');
  });
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'https' : 'http';
  var port = '';

  // cache busting is forced for IE / android / iOS6 ಠ_ಠ
  if (global.ActiveXObject || util.ua.android || util.ua.ios6 ||
      this.timestampRequests) {
    query[this.timestampParam] = +new Date;
  }

  query = util.qs(query);

  // avoid port if default for schema
  if (this.port && (('https' == schema && this.port != 443) ||
     ('http' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.hostname + port + this.path + query;
};

});
require.register("LearnBoost-engine.io-client/lib/transports/polling-xhr.js", function(exports, require, module){
/**
 * Module requirements.
 */

var Polling = require('./polling')
  , util = require('../util')
  , Emitter = require('../emitter')
  , debug = require('debug')('engine.io-client:polling-xhr');

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Global reference.
 */

var global = util.global();


/**
 * Obfuscated key for Blue Coat.
 */

var xobject = global[['Active'].concat('Object').join('X')];

/**
 * Empty function
 */

function empty(){}

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR(opts){
  Polling.call(this, opts);

  if (global.location) {
    var isSSL = 'https:' == location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (Number(port) !== port) {
      port = isSSL ? 443 : 80;
    }

    this.xd = opts.hostname != global.location.hostname ||
      port != opts.port;
  }
};

/**
 * Inherits from Polling.
 */

util.inherits(XHR, Polling);

/**
 * Opens the socket
 *
 * @api private
 */

XHR.prototype.doOpen = function(){
  var self = this;
  util.defer(function(){
    Polling.prototype.doOpen.call(self);
  });
};

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function(opts){
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.doWrite = function(data, fn){
  var req = this.request({ method: 'POST', data: data });
  var self = this;
  req.on('success', fn);
  req.on('error', function(err){
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function(){
  debug('xhr poll');
  var req = this.request();
  var self = this;
  req.on('data', function(data){
    self.onData(data);
  });
  req.on('error', function(err){
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request(opts){
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.async = false !== opts.async;
  this.data = undefined != opts.data ? opts.data : null;
  this.create();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function(){
  var xhr = this.xhr = util.request(this.xd);
  var self = this;

  xhr.open(this.method, this.uri, this.async);

  if ('POST' == this.method) {
    try {
      if (xhr.setRequestHeader) {
        // xmlhttprequest
        xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
      } else {
        // xdomainrequest
        xhr.contentType = 'text/plain';
      }
    } catch (e) {}
  }

  if (this.xd && global.XDomainRequest && xhr instanceof XDomainRequest) {
    xhr.onerror = function(e){
      self.onError(e);
    };
    xhr.onload = function(){
      self.onData(xhr.responseText);
    };
    xhr.onprogress = empty;
  } else {
    // ie6 check
    if ('withCredentials' in xhr) {
      xhr.withCredentials = true;
    }

    xhr.onreadystatechange = function(){
      var data;

      try {
        if (4 != xhr.readyState) return;
        if (200 == xhr.status || 1223 == xhr.status) {
          data = xhr.responseText;
        } else {
          self.onError(xhr.status);
        }
      } catch (e) {
        self.onError(e);
      }

      if (undefined !== data) {
        self.onData(data);
      }
    };
  }

  debug('sending xhr with url %s | data %s', this.uri, this.data);
  xhr.send(this.data);

  if (xobject) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function(){
  this.emit('success');
  this.cleanup();
};

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function(data){
  this.emit('data', data);
  this.onSuccess();
};

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function(err){
  this.emit('error', err);
  this.cleanup();
};

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function(){
  if ('undefined' == typeof this.xhr ) {
    return;
  }
  // xmlhttprequest
  this.xhr.onreadystatechange = empty;

  // xdomainrequest
  this.xhr.onload = this.xhr.onerror = empty;

  try {
    this.xhr.abort();
  } catch(e) {}

  if (xobject) {
    delete Request.requests[this.index];
  }

  this.xhr = null;
};

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function(){
  this.cleanup();
};

if (xobject) {
  Request.requestsCount = 0;
  Request.requests = {};

  global.attachEvent('onunload', function(){
    for (var i in Request.requests) {
      if (Request.requests.hasOwnProperty(i)) {
        Request.requests[i].abort();
      }
    }
  });
}

});
require.register("LearnBoost-engine.io-client/lib/transports/polling-jsonp.js", function(exports, require, module){

/**
 * Module requirements.
 */

var Polling = require('./polling')
  , util = require('../util');

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Global reference.
 */

var global = util.global();

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g;

/**
 * Global JSONP callbacks.
 */

var callbacks;

/**
 * Callbacks count.
 */

var index = 0;

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Polling.call(this, opts);

  // define global callbacks array if not present
  // we do this here (lazily) to avoid unneeded global pollution
  if (!callbacks) {
    // we need to consider multiple engines in the same page
    if (!global.___eio) global.___eio = [];
    callbacks = global.___eio;
  }

  // callback identifier
  this.index = callbacks.length;

  // add callback to jsonp global
  var self = this;
  callbacks.push(function (msg) {
    self.onData(msg);
  });

  // append to query string
  this.query.j = this.index;
};

/**
 * Inherits from Polling.
 */

util.inherits(JSONPPolling, Polling);

/**
 * Opens the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doOpen = function () {
  var self = this;
  util.defer(function () {
    Polling.prototype.doOpen.call(self);
  });
};

/**
 * Closes the socket
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
	var self = this;
  var script = document.createElement('script');

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.uri();
	script.onerror = function(e){
		self.onError('jsonp poll error',e);
	}

  var insertAt = document.getElementsByTagName('script')[0];
  insertAt.parentNode.insertBefore(script, insertAt);
  this.script = script;


  if (util.ua.gecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data, fn) {
  var self = this;

  if (!this.form) {
    var form = document.createElement('form');
    var area = document.createElement('textarea');
    var id = this.iframeId = 'eio_iframe_' + this.index;
    var iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.uri();

  function complete () {
    initIframe();
    fn();
  };

  function initIframe () {
    if (self.iframe) {
      try {
        self.form.removeChild(self.iframe);
      } catch (e) {
        self.onError('jsonp polling iframe removal error', e);
      }
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      var html = '<iframe src="javascript:0" name="'+ self.iframeId +'">';
      iframe = document.createElement(html);
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
      iframe.src = 'javascript:0';
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  };

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch(e) {}

  if (this.iframe.attachEvent) {
    this.iframe.onreadystatechange = function(){
      if (self.iframe.readyState == 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};

});
require.register("LearnBoost-engine.io-client/lib/transports/websocket.js", function(exports, require, module){
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('engine.io-parser')
  , util = require('../util')
  , debug = require('debug')('engine.io-client:websocket');

/**
 * Module exports.
 */

module.exports = WS;

/**
 * Global reference.
 */

var global = util.global();

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS(opts){
  Transport.call(this, opts);
};

/**
 * Inherits from Transport.
 */

util.inherits(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function(){
  if (!this.check()) {
    // let probe timeout
    return;
  }

  var self = this;

  this.socket = new (ws())(this.uri());
  this.socket.onopen = function(){
    self.onOpen();
  };
  this.socket.onclose = function(){
    self.onClose();
  };
  this.socket.onmessage = function(ev){
    self.onData(ev.data);
  };
  this.socket.onerror = function(e){
    self.onError('websocket error', e);
  };
};

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @api private
 */

WS.prototype.write = function(packets){
  var self = this;
  this.writable = false;
  // encodePacket efficient as it uses WS framing
  // no need for encodePayload
  for (var i = 0, l = packets.length; i < l; i++) {
    this.socket.send(parser.encodePacket(packets[i]));
  }
  function ondrain() {
    self.writable = true;
    self.emit('drain');
  }
  // check periodically if we're done sending
  if ('bufferedAmount' in this.socket) {
    this.bufferedAmountId = setInterval(function() {
      if (self.socket.bufferedAmount == 0) {
        clearInterval(self.bufferedAmountId);
        ondrain();
      }
    }, 50);
  } else {
    // fake drain
    // defer to next tick to allow Socket to clear writeBuffer
    setTimeout(ondrain, 0);
  }
};

/**
 * Called upon close
 *
 * @api private
 */

WS.prototype.onClose = function(){
  // stop checking to see if websocket is done sending buffer
  clearInterval(this.bufferedAmountId);
  Transport.prototype.onClose.call(this);
}

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function(){
  if (typeof this.socket !== 'undefined') {
    this.socket.close();
  }
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'wss' : 'ws';
  var port = '';

  // avoid port if default for schema
  if (this.port && (('wss' == schema && this.port != 443)
    || ('ws' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // append timestamp to URI
  if (this.timestampRequests) {
    query[this.timestampParam] = +new Date;
  }

  query = util.qs(query);

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.hostname + port + this.path + query;
};

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

WS.prototype.check = function(){
  var websocket = ws();
  return !!websocket && !('__initialize' in websocket && this.name === WS.prototype.name);
};

/**
 * Getter for WS constructor.
 *
 * @api private
 */

function ws(){
  if ('undefined' == typeof window) {
    return require('ws');
  }

  return global.WebSocket || global.MozWebSocket;
}

});
require.register("LearnBoost-engine.io-client/lib/transports/flashsocket.js", function(exports, require, module){
/**
 * Module dependencies.
 */

var WS = require('./websocket')
  , util = require('../util')
  , debug = require('debug')('engine.io-client:flashsocket');

/**
 * Module exports.
 */

module.exports = FlashWS;

/**
 * Global reference.
 */

var global = util.global()

/**
 * Obfuscated key for Blue Coat.
 */

var xobject = global[['Active'].concat('Object').join('X')];

/**
 * FlashWS constructor.
 *
 * @api public
 */

function FlashWS (options) {
  WS.call(this, options);
  this.flashPath = options.flashPath;
  this.policyPort = options.policyPort;
};

/**
 * Inherits from WebSocket.
 */

util.inherits(FlashWS, WS);

/**
 * Transport name.
 *
 * @api public
 */

FlashWS.prototype.name = 'flashsocket';

/**
 * Opens the transport.
 *
 * @api public
 */

FlashWS.prototype.doOpen = function () {
  if (!this.check()) {
    // let the probe timeout
    return;
  }

  // instrument websocketjs logging
  function log (type) {
    return function(){
      var str = Array.prototype.join.call(arguments, ' ');
      debug('[websocketjs %s] %s', type, str);
    };
  };

  WEB_SOCKET_LOGGER = { log: log('debug'), error: log('error') };
  WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;
  WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = true;

  if ('undefined' == typeof WEB_SOCKET_SWF_LOCATION) {
    WEB_SOCKET_SWF_LOCATION = this.flashPath + 'WebSocketMainInsecure.swf';
  }

  // dependencies
  var deps = [this.flashPath + 'web_socket.js'];

  if ('undefined' == typeof swfobject) {
    deps.unshift(this.flashPath + 'swfobject.js');
  }

  var self = this;

  load(deps, function () {
    self.ready(function () {
      WebSocket.__addTask(function () {
        WS.prototype.doOpen.call(self);
      });
    });
  });
};

/**
 * Override to prevent closing uninitialized flashsocket.
 *
 * @api private
 */

FlashWS.prototype.doClose = function () {
  if (!this.socket) return;
  var self = this;
  WebSocket.__addTask(function() {
    WS.prototype.doClose.call(self);
  });
};

/**
 * Writes to the Flash socket.
 *
 * @api private
 */

FlashWS.prototype.write = function() {
  var self = this, args = arguments;
  WebSocket.__addTask(function () {
    WS.prototype.write.apply(self, args);
  });
};

/**
 * Called upon dependencies are loaded.
 *
 * @api private
 */

FlashWS.prototype.ready = function (fn) {
  if (typeof WebSocket == 'undefined' ||
    !('__initialize' in WebSocket) || !swfobject) {
    return;
  }

  if (swfobject.getFlashPlayerVersion().major < 10) {
    return;
  }

  function init () {
    // Only start downloading the swf file when the checked that this browser
    // actually supports it
    if (!FlashWS.loaded) {
      if (843 != self.policyPort) {
        WebSocket.loadFlashPolicyFile('xmlsocket://' + self.host + ':' + self.policyPort);
      }

      WebSocket.__initialize();
      FlashWS.loaded = true;
    }

    fn.call(self);
  }

  var self = this;
  if (document.body) {
    return init();
  }

  util.load(init);
};

/**
 * Feature detection for flashsocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

FlashWS.prototype.check = function () {
  if ('undefined' == typeof window) {
    return false;
  }

  if (typeof WebSocket != 'undefined' && !('__initialize' in WebSocket)) {
    return false;
  }

  if (xobject) {
    var control = null;
    try {
      control = new xobject('ShockwaveFlash.ShockwaveFlash');
    } catch (e) { }
    if (control) {
      return true;
    }
  } else {
    for (var i = 0, l = navigator.plugins.length; i < l; i++) {
      for (var j = 0, m = navigator.plugins[i].length; j < m; j++) {
        if (navigator.plugins[i][j].description == 'Shockwave Flash') {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Lazy loading of scripts.
 * Based on $script by Dustin Diaz - MIT
 */

var scripts = {};

/**
 * Injects a script. Keeps tracked of injected ones.
 *
 * @param {String} path
 * @param {Function} callback
 * @api private
 */

function create (path, fn) {
  if (scripts[path]) return fn();

  var el = document.createElement('script');
  var loaded = false;

  debug('loading "%s"', path);
  el.onload = el.onreadystatechange = function () {
    if (loaded || scripts[path]) return;
    var rs = el.readyState;
    if (!rs || 'loaded' == rs || 'complete' == rs) {
      debug('loaded "%s"', path);
      el.onload = el.onreadystatechange = null;
      loaded = true;
      scripts[path] = true;
      fn();
    }
  };

  el.async = 1;
  el.src = path;

  var head = document.getElementsByTagName('head')[0];
  head.insertBefore(el, head.firstChild);
};

/**
 * Loads scripts and fires a callback.
 *
 * @param {Array} paths
 * @param {Function} callback
 */

function load (arr, fn) {
  function process (i) {
    if (!arr[i]) return fn();
    create(arr[i], function () {
      process(++i);
    });
  };

  process(0);
};

});
require.register("wearefractal-protosock/dist/main.js", function(exports, require, module){
// Generated by CoffeeScript 1.4.0
(function() {
  var Client, Server, defaultClient, defaultServer, ps, util;

  util = require('./util');

  Client = require('./Client');

  defaultClient = require('./defaultClient');

  ps = {
    createClientWrapper: function(plugin) {
      return function(opt) {
        return ps.createClient(plugin, opt);
      };
    },
    createClient: function(plugin, opt) {
      var newPlugin;
      newPlugin = util.mergePlugins(defaultClient, plugin);
      return new Client(newPlugin, opt);
    }
  };

  if (!(typeof window !== "undefined" && window !== null)) {
    Server = require('./Server');
    defaultServer = require('./defaultServer');
    require("http").globalAgent.maxSockets = 999;
    ps.createServer = function(httpServer, plugin, opt) {
      var newPlugin;
      newPlugin = util.mergePlugins(defaultServer, plugin);
      return new Server(httpServer, newPlugin, opt);
    };
    ps.createServerWrapper = function(plugin) {
      return function(httpServer, opt) {
        return ps.createServer(httpServer, plugin, opt);
      };
    };
  }

  module.exports = ps;

}).call(this);

});
require.register("wearefractal-protosock/dist/Socket.js", function(exports, require, module){
// Generated by CoffeeScript 1.4.0
(function() {
  var sock;

  sock = {
    write: function(msg) {
      var _this = this;
      this.parent.outbound(this, msg, function(fmt) {
        return _this.send(fmt);
      });
      return this;
    },
    disconnect: function(r) {
      this.close(r);
      return this;
    }
  };

  module.exports = sock;

}).call(this);

});
require.register("wearefractal-protosock/dist/util.js", function(exports, require, module){
// Generated by CoffeeScript 1.4.0
(function() {
  var nu, util,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  nu = require('./Socket');

  util = {
    extendSocket: function(Socket) {
      return __extends(Socket.prototype, nu);
    },
    mergePlugins: function() {
      var args, k, newPlugin, plugin, v, _i, _len;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      newPlugin = {};
      for (_i = 0, _len = args.length; _i < _len; _i++) {
        plugin = args[_i];
        for (k in plugin) {
          v = plugin[k];
          if (typeof v === 'object' && k !== 'server') {
            newPlugin[k] = util.mergePlugins(newPlugin[k], v);
          } else {
            newPlugin[k] = v;
          }
        }
      }
      return newPlugin;
    }
  };

  module.exports = util;

}).call(this);

});
require.register("wearefractal-protosock/dist/defaultClient.js", function(exports, require, module){
// Generated by CoffeeScript 1.4.0
(function() {
  var def;

  def = {
    options: {},
    start: function() {},
    inbound: function(socket, msg, done) {
      var parsed;
      try {
        parsed = JSON.parse(msg);
      } catch (e) {
        this.error(socket, e);
      }
      done(parsed);
    },
    outbound: function(socket, msg, done) {
      var parsed;
      try {
        parsed = JSON.stringify(msg);
      } catch (e) {
        this.error(socket, e);
      }
      done(parsed);
    },
    validate: function(socket, msg, done) {
      return done(true);
    },
    invalid: function() {},
    connect: function() {},
    message: function() {},
    error: function() {},
    close: function() {}
  };

  if (typeof window !== "undefined" && window !== null) {
    def.options = {
      host: window.location.hostname,
      port: (window.location.port.length > 0 ? parseInt(window.location.port) : 80),
      secure: window.location.protocol === 'https:'
    };
    if (def.options.secure) {
      def.options.port = 443;
    }
  }

  module.exports = def;

}).call(this);

});
require.register("wearefractal-protosock/dist/Client.js", function(exports, require, module){
// Generated by CoffeeScript 1.4.0
(function() {
  var Client, EventEmitter, engineClient, getDelay, util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  util = require('./util');

  if (typeof window !== "undefined" && window !== null) {
    engineClient = require('engine.io');
    EventEmitter = require('emitter');
  } else {
    engineClient = require('engine.io-client');
    EventEmitter = require('events').EventEmitter;
  }

  util.extendSocket(engineClient.Socket);

  getDelay = function(a) {
    if (a > 10) {
      return 15000;
    } else if (a > 5) {
      return 5000;
    } else if (a > 3) {
      return 1000;
    }
    return 1000;
  };

  Client = (function(_super) {

    __extends(Client, _super);

    function Client(plugin, options) {
      var eiopts, k, v, _base, _base1, _base2, _ref, _ref1, _ref2;
      if (options == null) {
        options = {};
      }
      this.reconnect = __bind(this.reconnect, this);

      this.handleClose = __bind(this.handleClose, this);

      this.handleError = __bind(this.handleError, this);

      this.handleMessage = __bind(this.handleMessage, this);

      this.handleConnection = __bind(this.handleConnection, this);

      for (k in plugin) {
        v = plugin[k];
        this[k] = v;
      }
      for (k in options) {
        v = options[k];
        this.options[k] = v;
      }
      if ((_ref = (_base = this.options).reconnect) == null) {
        _base.reconnect = true;
      }
      if ((_ref1 = (_base1 = this.options).reconnectLimit) == null) {
        _base1.reconnectLimit = Infinity;
      }
      if ((_ref2 = (_base2 = this.options).reconnectTimeout) == null) {
        _base2.reconnectTimeout = Infinity;
      }
      this.isServer = false;
      this.isClient = true;
      this.isBrowser = typeof window !== "undefined" && window !== null;
      eiopts = {
        host: this.options.host,
        port: this.options.port,
        secure: this.options.secure,
        path: "/" + this.options.namespace,
        resource: this.options.resource,
        transports: this.options.transports,
        upgrade: this.options.upgrade,
        flashPath: this.options.flashPath,
        policyPort: this.options.policyPort,
        forceJSONP: this.options.forceJSONP,
        forceBust: this.options.forceBust,
        debug: this.options.debug
      };
      this.ssocket = new engineClient(eiopts);
      this.ssocket.parent = this;
      this.ssocket.once('open', this.handleConnection);
      this.ssocket.on('error', this.handleError);
      this.ssocket.on('message', this.handleMessage);
      this.ssocket.on('close', this.handleClose);
      this.start();
      return;
    }

    Client.prototype.disconnect = function() {
      this.ssocket.disconnect();
      return this;
    };

    Client.prototype.destroy = function() {
      this.options.reconnect = false;
      this.ssocket.disconnect();
      this.emit("destroyed");
      return this;
    };

    Client.prototype.handleConnection = function() {
      this.emit('connected');
      return this.connect(this.ssocket);
    };

    Client.prototype.handleMessage = function(msg) {
      var _this = this;
      this.emit('inbound', this.ssocket, msg);
      return this.inbound(this.ssocket, msg, function(formatted) {
        return _this.validate(_this.ssocket, formatted, function(valid) {
          if (valid) {
            _this.emit('message', _this.ssocket, formatted);
            return _this.message(_this.ssocket, formatted);
          } else {
            _this.emit('invalid', _this.ssocket, formatted);
            return _this.invalid(_this.ssocket, formatted);
          }
        });
      });
    };

    Client.prototype.handleError = function(err) {
      if (typeof err === 'string') {
        err = new Error(err);
      }
      return this.error(this.ssocket, err);
    };

    Client.prototype.handleClose = function(reason) {
      var _this = this;
      if (this.ssocket.reconnecting) {
        return;
      }
      if (this.options.reconnect) {
        return this.reconnect(function(err) {
          if (err == null) {
            return;
          }
          _this.emit('close', _this.ssocket, reason);
          return _this.close(_this.ssocket, reason);
        });
      } else {
        this.emit('close', this.ssocket, reason);
        return this.close(this.ssocket, reason);
      }
    };

    Client.prototype.reconnect = function(cb) {
      var attempts, connect, done, err, maxAttempts, start, timeout,
        _this = this;
      if (this.ssocket.reconnecting) {
        return cb("Already reconnecting");
      }
      this.ssocket.reconnecting = true;
      if (this.ssocket.readyState === 'open') {
        this.ssocket.disconnect();
      }
      start = Date.now();
      maxAttempts = this.options.reconnectLimit;
      timeout = this.options.reconnectTimeout;
      attempts = 0;
      done = function() {
        _this.ssocket.reconnecting = false;
        _this.emit("reconnected");
        return cb();
      };
      err = function(e) {
        _this.ssocket.reconnecting = false;
        return cb(e);
      };
      this.ssocket.once('open', done);
      connect = function() {
        if (!_this.ssocket.reconnecting) {
          return;
        }
        if (attempts >= maxAttempts) {
          return err("Exceeded max attempts");
        }
        if ((Date.now() - start) > timeout) {
          return err("Timeout on reconnect");
        }
        attempts++;
        _this.ssocket.open();
        return setTimeout(connect, getDelay(attempts));
      };
      return setTimeout(connect, getDelay(attempts));
    };

    return Client;

  })(EventEmitter);

  module.exports = Client;

}).call(this);

});
require.register("component-indexof/index.js", function(exports, require, module){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
});
require.register("component-emitter/index.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var index = require('indexof');

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  fn._off = on;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var i = index(callbacks, fn._off || fn);
  if (~i) callbacks.splice(i, 1);
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

});
require.register("holla/dist/holla.js", function(exports, require, module){
// Generated by CoffeeScript 1.6.2
(function() {
  var Call, ProtoSock, client, holla, shims;

  Call = require('./Call');

  shims = require('./shims');

  ProtoSock = require('protosock');

  client = {
    options: {
      namespace: 'holla',
      resource: 'default',
      debug: false
    },
    register: function(name, cb) {
      var _this = this;

      this.ssocket.write({
        type: "register",
        args: {
          name: name
        }
      });
      return this.once("register", function(worked) {
        if (worked) {
          _this.user = name;
          _this.emit("authorized");
        }
        _this.authorized = worked;
        return typeof cb === "function" ? cb(worked) : void 0;
      });
    },
    call: function(user) {
      return new Call(this, user, true);
    },
    chat: function(user, msg) {
      this.ssocket.write({
        type: "chat",
        to: user,
        args: {
          message: msg
        }
      });
      return this;
    },
    ready: function(fn) {
      if (this.authorized) {
        fn();
      } else {
        this.once('authorized', fn);
      }
      return this;
    },
    validate: function(socket, msg, done) {
      if (this.options.debug) {
        console.log(msg);
      }
      if (typeof msg !== 'object') {
        return done(false);
      }
      if (typeof msg.type !== 'string') {
        return done(false);
      }
      if (msg.type === "register") {
        if (typeof msg.args !== 'object') {
          return done(false);
        }
        if (typeof msg.args.result !== 'boolean') {
          return done(false);
        }
      } else if (msg.type === "offer") {
        if (typeof msg.from !== 'string') {
          return done(false);
        }
      } else if (msg.type === "answer") {
        if (typeof msg.args !== 'object') {
          return done(false);
        }
        if (typeof msg.from !== 'string') {
          return done(false);
        }
        if (typeof msg.args.accepted !== 'boolean') {
          return done(false);
        }
      } else if (msg.type === "sdp") {
        if (typeof msg.args !== 'object') {
          return done(false);
        }
        if (typeof msg.from !== 'string') {
          return done(false);
        }
        if (!msg.args.sdp) {
          return done(false);
        }
        if (!msg.args.type) {
          return done(false);
        }
      } else if (msg.type === "candidate") {
        if (typeof msg.args !== 'object') {
          return done(false);
        }
        if (typeof msg.from !== 'string') {
          return done(false);
        }
        if (typeof msg.args.candidate !== 'object') {
          return done(false);
        }
      } else if (msg.type === "chat") {
        if (typeof msg.args !== 'object') {
          return done(false);
        }
        if (typeof msg.from !== 'string') {
          return done(false);
        }
        if (typeof msg.args.message !== 'string') {
          return done(false);
        }
      } else if (msg.type === "hangup") {
        if (typeof msg.from !== 'string') {
          return done(false);
        }
      } else if (msg.type === "presence") {
        if (typeof msg.args !== 'object') {
          return done(false);
        }
        if (typeof msg.args.name !== 'string') {
          return done(false);
        }
        if (typeof msg.args.online !== 'boolean') {
          return done(false);
        }
      } else {
        return done(false);
      }
      return done(true);
    },
    error: function(socket, err) {
      return this.emit('error', err, socket);
    },
    message: function(socket, msg) {
      var c;

      switch (msg.type) {
        case "register":
          return this.emit("register", msg.args.result);
        case "offer":
          c = new Call(this, msg.from, false);
          return this.emit("call", c);
        case "presence":
          this.emit("presence", msg.args);
          return this.emit("presence." + msg.args.name, msg.args.online);
        case "chat":
          this.emit("chat", {
            from: msg.from,
            message: msg.args.message
          });
          return this.emit("chat." + msg.from, msg.args.message);
        case "hangup":
          this.emit("hangup", {
            from: msg.from
          });
          return this.emit("hangup." + msg.from);
        case "answer":
          this.emit("answer", {
            from: msg.from,
            accepted: msg.args.accepted
          });
          return this.emit("answer." + msg.from, msg.args.accepted);
        case "candidate":
          this.emit("candidate", {
            from: msg.from,
            candidate: msg.args.candidate
          });
          return this.emit("candidate." + msg.from, msg.args.candidate);
        case "sdp":
          this.emit("sdp", {
            from: msg.from,
            sdp: msg.args.sdp,
            type: msg.args.type
          });
          return this.emit("sdp." + msg.from, msg.args);
      }
    }
  };

  holla = {
    createClient: ProtoSock.createClientWrapper(client),
    Call: Call,
    supported: shims.supported,
    config: shims.PeerConnConfig,
    streamToBlob: function(s) {
      return shims.URL.createObjectURL(s);
    },
    pipe: function(stream, el) {
      var uri;

      uri = holla.streamToBlob(stream);
      return shims.attachStream(uri, el);
    },
    record: shims.recordVideo,
    createStream: function(opt, cb) {
      var err, succ;

      if (shims.getUserMedia == null) {
        return cb("Missing getUserMedia");
      }
      err = cb;
      succ = function(s) {
        return cb(null, s);
      };
      shims.getUserMedia(opt, succ, err);
      return holla;
    },
    createFullStream: function(cb) {
      return holla.createStream({
        video: true,
        audio: true
      }, cb);
    },
    createVideoStream: function(cb) {
      return holla.createStream({
        video: true,
        audio: false
      }, cb);
    },
    createAudioStream: function(cb) {
      return holla.createStream({
        video: false,
        audio: true
      }, cb);
    }
  };

  module.exports = holla;

}).call(this);

});
require.register("holla/dist/Call.js", function(exports, require, module){
// Generated by CoffeeScript 1.6.2
(function() {
  var Call, EventEmitter, shims,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  shims = require('./shims');

  EventEmitter = require('emitter');

  Call = (function(_super) {
    __extends(Call, _super);

    function Call(parent, user, isCaller) {
      var _this = this;

      this.parent = parent;
      this.user = user;
      this.isCaller = isCaller;
      this.initSDP = __bind(this.initSDP, this);
      this.unmute = __bind(this.unmute, this);
      this.mute = __bind(this.mute, this);
      this.end = __bind(this.end, this);
      this.releaseStream = __bind(this.releaseStream, this);
      this.decline = __bind(this.decline, this);
      this.answer = __bind(this.answer, this);
      this.chat = __bind(this.chat, this);
      this.duration = __bind(this.duration, this);
      this.ready = __bind(this.ready, this);
      this.addStream = __bind(this.addStream, this);
      this.createConnection = __bind(this.createConnection, this);
      this.processRemoteSDP = __bind(this.processRemoteSDP, this);
      this.startTime = new Date;
      this.socket = this.parent.ssocket;
      this.pc = this.createConnection();
      if (this.isCaller) {
        this.socket.write({
          type: "offer",
          to: this.user
        });
      }
      this.emit("calling");
      this.parent.on("answer." + this.user, function(accepted) {
        if (!accepted) {
          return _this.emit("rejected");
        }
        _this.emit("answered");
        if (_this.isCaller) {
          return _this.initSDP();
        }
      });
      this.parent.on("candidate." + this.user, function(candidate) {
        return _this.pc.addIceCandidate(new shims.IceCandidate(candidate));
      });
      this.parent.on("sdp." + this.user, this.processRemoteSDP);
      this.parent.on("hangup." + this.user, function() {
        return _this.emit("hangup");
      });
      this.parent.on("chat." + this.user, function(msg) {
        return _this.emit("chat", msg);
      });
    }

    Call.prototype.processRemoteSDP = function(desc) {
      var err, succ,
        _this = this;

      if (this.pc.remoteDescription) {
        return;
      }
      console.log("" + this.isCaller + " remote", desc);
      desc.sdp = shims.processSDPIn(desc.sdp);
      err = function(e) {
        throw e;
      };
      succ = function() {
        _this.emit("sdp");
        if (!_this.isCaller) {
          return _this.initSDP();
        }
      };
      return this.pc.setRemoteDescription(new shims.SessionDescription(desc), succ, err);
    };

    Call.prototype.createConnection = function() {
      var pc,
        _this = this;

      pc = new shims.PeerConnection(shims.PeerConnConfig, shims.constraints);
      pc.onconnecting = function() {
        _this.emit('connecting');
      };
      pc.onopen = function() {
        _this.emit('connected');
      };
      pc.onicecandidate = function(evt) {
        if (evt.candidate) {
          _this.socket.write({
            type: "candidate",
            to: _this.user,
            args: {
              candidate: evt.candidate
            }
          });
        }
      };
      pc.onaddstream = function(evt) {
        _this.remoteStream = evt.stream;
        _this._ready = true;
        _this.emit("ready", _this.remoteStream);
      };
      pc.onremovestream = function(evt) {
        console.log("removestream", evt);
        _this.end();
        _this.emit('hangup');
      };
      return pc;
    };

    Call.prototype.addStream = function(s) {
      this.localStream = s;
      this.pc.addStream(s);
      return this;
    };

    Call.prototype.ready = function(fn) {
      if (this._ready) {
        fn(this.remoteStream);
      } else {
        this.once('ready', fn);
      }
      return this;
    };

    Call.prototype.duration = function() {
      var e, s;

      if (this.endTime != null) {
        s = this.endTime.getTime();
      }
      if (s == null) {
        s = Date.now();
      }
      e = this.startTime.getTime();
      return (s - e) / 1000;
    };

    Call.prototype.chat = function(msg) {
      this.parent.chat(this.user, msg);
      return this;
    };

    Call.prototype.answer = function() {
      this.startTime = new Date;
      this.socket.write({
        type: "answer",
        to: this.user,
        args: {
          accepted: true
        }
      });
      return this;
    };

    Call.prototype.decline = function() {
      this.socket.write({
        type: "answer",
        to: this.user,
        args: {
          accepted: false
        }
      });
      return this;
    };

    Call.prototype.releaseStream = function() {
      return this.localStream.stop();
    };

    Call.prototype.end = function() {
      this.endTime = new Date;
      try {
        this.pc.close();
      } catch (_error) {}
      this.socket.write({
        type: "hangup",
        to: this.user
      });
      this.emit("hangup");
      return this;
    };

    Call.prototype.mute = function() {
      var track, _i, _len, _ref, _results;

      _ref = this.localStream.getAudioTracks();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        track = _ref[_i];
        _results.push(track.enabled = false);
      }
      return _results;
    };

    Call.prototype.unmute = function() {
      var track, _i, _len, _ref, _results;

      _ref = this.localStream.getAudioTracks();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        track = _ref[_i];
        _results.push(track.enabled = true);
      }
      return _results;
    };

    Call.prototype.initSDP = function() {
      var done, err,
        _this = this;

      done = function(desc) {
        desc.sdp = shims.processSDPOut(desc.sdp);
        console.log("" + _this.isCaller + " local", desc);
        _this.pc.setLocalDescription(desc);
        return _this.socket.write({
          type: "sdp",
          to: _this.user,
          args: desc
        });
      };
      err = function(e) {
        throw e;
      };
      if (this.isCaller) {
        return this.pc.createOffer(done, err, shims.constraints);
      }
      if (this.pc.remoteDescription) {
        return this.pc.createAnswer(done, err, shims.constraints);
      } else {
        return this.once("sdp", function() {
          return _this.pc.createAnswer(done, err, shims.constraints);
        });
      }
    };

    return Call;

  })(EventEmitter);

  module.exports = Call;

}).call(this);

});
require.register("holla/dist/shims.js", function(exports, require, module){
// Generated by CoffeeScript 1.6.2
(function() {
  var IceCandidate, MediaStream, PeerConnection, SessionDescription, URL, attachStream, browser, extract, getUserMedia, loadBlob, processSDPIn, processSDPOut, recordVideo, removeCN, replaceCodec, saveBlob, shim, supported, useOPUS;

  PeerConnection = window.mozRTCPeerConnection || window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection;

  IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;

  SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;

  MediaStream = window.MediaStream || window.webkitMediaStream;

  getUserMedia = navigator.mozGetUserMedia || navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;

  URL = window.URL || window.webkitURL || window.msURL || window.oURL;

  if (getUserMedia != null) {
    getUserMedia = getUserMedia.bind(navigator);
  }

  browser = (navigator.mozGetUserMedia ? 'firefox' : 'chrome');

  supported = (PeerConnection != null) && (getUserMedia != null);

  extract = function(str, reg) {
    var match;

    match = str.match(reg);
    return (match != null ? match[1] : null);
  };

  replaceCodec = function(line, codec) {
    var el, els, idx, out, _i, _len;

    els = line.split(' ');
    out = [];
    for (idx = _i = 0, _len = els.length; _i < _len; idx = ++_i) {
      el = els[idx];
      if (idx === 3) {
        out[idx++] = codec;
      }
      if (el !== codec) {
        out[idx++] = el;
      }
    }
    return out.join(' ');
  };

  removeCN = function(lines, mLineIdx) {
    var cnPos, idx, line, mLineEls, payload, _i, _len;

    mLineEls = lines[mLineIdx].split(' ');
    for (idx = _i = 0, _len = lines.length; _i < _len; idx = ++_i) {
      line = lines[idx];
      if (!(line != null)) {
        continue;
      }
      payload = extract(line, /a=rtpmap:(\d+) CN\/\d+/i);
      if (payload != null) {
        cnPos = mLineEls.indexOf(payload);
        if (cnPos !== -1) {
          mLineEls.splice(cnPos, 1);
        }
        lines.splice(idx, 1);
      }
    }
    lines[mLineIdx] = mLineEls.join(' ');
    return lines;
  };

  useOPUS = function(sdp) {
    var idx, line, lines, mLineIdx, payload, _i, _len;

    lines = sdp.split('\r\n');
    mLineIdx = ((function() {
      var _i, _len, _results;

      _results = [];
      for (idx = _i = 0, _len = lines.length; _i < _len; idx = ++_i) {
        line = lines[idx];
        if (line.indexOf('m=audio') !== -1) {
          _results.push(idx);
        }
      }
      return _results;
    })())[0];
    if (mLineIdx == null) {
      return sdp;
    }
    for (idx = _i = 0, _len = lines.length; _i < _len; idx = ++_i) {
      line = lines[idx];
      if (!(line.indexOf('opus/48000') !== -1)) {
        continue;
      }
      payload = extract(line, /:(\d+) opus\/48000/i);
      if (payload != null) {
        lines[mLineIdx] = replaceCodec(lines[mLineIdx], payload);
      }
      break;
    }
    lines = removeCN(lines, mLineIdx);
    return lines.join('\r\n');
  };

  processSDPOut = function(sdp) {
    var addCrypto, line, out, _i, _j, _len, _len1, _ref, _ref1;

    out = [];
    if (browser === 'firefox') {
      addCrypto = "a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:BAADBAADBAADBAADBAADBAADBAADBAADBAADBAAD";
      _ref = sdp.split('\r\n');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        line = _ref[_i];
        out.push(line);
        if (line.indexOf('m=') === 0) {
          out.push(addCrypto);
        }
      }
    } else {
      _ref1 = sdp.split('\r\n');
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        line = _ref1[_j];
        if (line.indexOf("a=ice-options:google-ice") === -1) {
          out.push(line);
        }
      }
    }
    return useOPUS(out.join('\r\n'));
  };

  processSDPIn = function(sdp) {
    return sdp;
  };

  attachStream = function(uri, el) {
    var e, _i, _len;

    if (typeof el === "string") {
      return attachStream(uri, document.getElementById(el));
    } else if (el.jquery) {
      el.attr('src', uri);
      for (_i = 0, _len = el.length; _i < _len; _i++) {
        e = el[_i];
        e.play();
      }
    } else {
      el.src = uri;
      el.play();
    }
    return el;
  };

  saveBlob = function(file, blob) {
    var evt, link;

    link = document.createElement("a");
    link.href = blob;
    link.target = "_blank";
    link.download = file;
    evt = document.createEvent("Event");
    evt.initEvent("click", true, true);
    link.dispatchEvent(evt);
    URL.revokeObjectURL(link.href);
  };

  loadBlob = function(blob, cb) {
    var reader;

    reader = new FileReader;
    reader.readAsDataURL(blob);
    return reader.onload = function(event) {
      return cb(event.target.result);
    };
  };

  recordVideo = function(el) {
    var can, ctrl, ctx, end, frames, getBlob, grab, h, requested, save, w;

    if (el.jquery) {
      h = el.height();
      w = el.width();
      el = el[0];
    } else {
      h = el.height;
      w = el.width;
    }
    can = document.createElement('canvas');
    ctx = can.getContext('2d');
    can.width = w;
    can.height = h;
    frames = [];
    grab = function() {
      var requested;

      requested = requestAnimationFrame(grab);
      ctx.drawImage(el, 0, 0, w, h);
      frames.push(can.toDataURL('image/webp', 1));
    };
    getBlob = function(cb) {
      var blob;

      blob = Whammy.fromImageArray(frames, 1000 / 60);
      loadBlob(blob, cb);
      return ctrl;
    };
    save = function(file) {
      if (file == null) {
        file = "recording.webp";
      }
      getBlob(function(blob) {
        return saveBlob(file, blob);
      });
      return ctrl;
    };
    end = function(cb) {
      cancelAnimationFrame(requested);
      return ctrl;
    };
    requested = requestAnimationFrame(grab);
    ctrl = {
      save: save,
      getBlob: getBlob,
      end: end
    };
    return ctrl;
  };

  shim = function() {
    var PeerConnConfig, mediaConstraints, out;

    if (!supported) {
      return;
    }
    if (browser === 'firefox') {
      PeerConnConfig = {
        iceServers: [
          {
            url: "stun:23.21.150.121"
          }
        ]
      };
      mediaConstraints = {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true,
          MozDontOfferDataChannel: true
        }
      };
      MediaStream.prototype.getVideoTracks = function() {
        return [];
      };
      MediaStream.prototype.getAudioTracks = function() {
        return [];
      };
    } else {
      PeerConnConfig = {
        iceServers: [
          {
            url: "stun:stun.l.google.com:19302"
          }
        ]
      };
      mediaConstraints = {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        },
        optional: [
          {
            DtlsSrtpKeyAgreement: true
          }
        ]
      };
      if (!MediaStream.prototype.getVideoTracks) {
        MediaStream.prototype.getVideoTracks = function() {
          return this.videoTracks;
        };
        MediaStream.prototype.getAudioTracks = function() {
          return this.audioTracks;
        };
      }
      if (!PeerConnection.prototype.getLocalStreams) {
        PeerConnection.prototype.getLocalStreams = function() {
          return this.localStreams;
        };
        PeerConnection.prototype.getRemoteStreams = function() {
          return this.remoteStreams;
        };
      }
    }
    out = {
      PeerConnection: PeerConnection,
      IceCandidate: IceCandidate,
      SessionDescription: SessionDescription,
      MediaStream: MediaStream,
      getUserMedia: getUserMedia,
      URL: URL,
      attachStream: attachStream,
      processSDPIn: processSDPIn,
      processSDPOut: processSDPOut,
      PeerConnConfig: PeerConnConfig,
      browser: browser,
      supported: supported,
      constraints: mediaConstraints,
      recordVideo: recordVideo,
      loadBlob: loadBlob,
      saveBlob: saveBlob
    };
    return out;
  };

  
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
/* https://github.com/antimatter15/whammy */
var Whammy=function(){function g(a){for(var b=a[0].width,e=a[0].height,c=a[0].duration,d=1;d<a.length;d++){if(a[d].width!=b)throw"Frame "+(d+1)+" has a different width";if(a[d].height!=e)throw"Frame "+(d+1)+" has a different height";if(0>a[d].duration)throw"Frame "+(d+1)+" has a weird duration";c+=a[d].duration}var f=0,a=[{id:440786851,data:[{data:1,id:17030},{data:1,id:17143},{data:4,id:17138},{data:8,id:17139},{data:"webm",id:17026},{data:2,id:17031},{data:2,id:17029}]},{id:408125543,data:[{id:357149030,
data:[{data:1E6,id:2807729},{data:"whammy",id:19840},{data:"whammy",id:22337},{data:[].slice.call(new Uint8Array((new Float64Array([c])).buffer),0).map(function(a){return String.fromCharCode(a)}).reverse().join(""),id:17545}]},{id:374648427,data:[{id:174,data:[{data:1,id:215},{data:1,id:25541},{data:0,id:156},{data:"und",id:2274716},{data:"V_VP8",id:134},{data:"VP8",id:2459272},{data:1,id:131},{id:224,data:[{data:b,id:176},{data:e,id:186}]}]}]},{id:524531317,data:[{data:0,id:231}].concat(a.map(function(a){var b;
b=a.data.slice(4);var c=Math.round(f);b=[129,c>>8,c&255,128].map(function(a){return String.fromCharCode(a)}).join("")+b;f+=a.duration;return{data:b,id:163}}))}]}];return j(a)}function m(a){for(var b=[];0<a;)b.push(a&255),a>>=8;return new Uint8Array(b.reverse())}function k(a){for(var b=[],a=(a.length%8?Array(9-a.length%8).join("0"):"")+a,e=0;e<a.length;e+=8)b.push(parseInt(a.substr(e,8),2));return new Uint8Array(b)}function j(a){for(var b=[],e=0;e<a.length;e++){var c=a[e].data;"object"==typeof c&&
(c=j(c));"number"==typeof c&&(c=k(c.toString(2)));if("string"==typeof c){for(var d=new Uint8Array(c.length),f=0;f<c.length;f++)d[f]=c.charCodeAt(f);c=d}f=c.size||c.byteLength;d=Math.ceil(Math.ceil(Math.log(f)/Math.log(2))/8);f=f.toString(2);f=Array(7*d+8-f.length).join("0")+f;d=Array(d).join("0")+"1"+f;b.push(m(a[e].id));b.push(k(d));b.push(c)}return new Blob(b,{type:"video/webm"})}function l(a){for(var b=a.RIFF[0].WEBP[0],e=b.indexOf("\u009d\u0001*"),c=0,d=[];4>c;c++)d[c]=b.charCodeAt(e+3+c);c=d[1]<<
8|d[0];e=c&16383;c=d[3]<<8|d[2];return{width:e,height:c&16383,data:b,riff:a}}function h(a){for(var b=0,e={};b<a.length;){var c=a.substr(b,4),d=parseInt(a.substr(b+4,4).split("").map(function(a){a=a.charCodeAt(0).toString(2);return Array(8-a.length+1).join("0")+a}).join(""),2),f=a.substr(b+4+4,d),b=b+(8+d);e[c]=e[c]||[];"RIFF"==c||"LIST"==c?e[c].push(h(f)):e[c].push(f)}return e}function i(a,b){this.frames=[];this.duration=1E3/a;this.quality=b||0.8}i.prototype.add=function(a,b){if("undefined"!=typeof b&&
this.duration)throw"you can't pass a duration if the fps is set";if("undefined"==typeof b&&!this.duration)throw"if you don't have the fps set, you ned to have durations here.";a.canvas&&(a=a.canvas);if(a.toDataURL)a=a.toDataURL("image/webp",this.quality);else if("string"!=typeof a)throw"frame must be a a HTMLCanvasElement, a CanvasRenderingContext2D or a DataURI formatted string";if(!/^data:image\/webp;base64,/ig.test(a))throw"Input must be formatted properly as a base64 encoded DataURI of type image/webp";
this.frames.push({image:a,duration:b||this.duration})};i.prototype.compile=function(){return new g(this.frames.map(function(a){var b=l(h(atob(a.image.slice(23))));b.duration=a.duration;return b}))};return{Video:i,fromImageArray:function(a,b){return g(a.map(function(a){a=l(h(atob(a.slice(23))));a.duration=1E3/b;return a}))},toWebM:g}}();
;

  module.exports = shim();

}).call(this);

});
require.alias("wearefractal-protosock/dist/main.js", "holla/deps/protosock/dist/main.js");
require.alias("wearefractal-protosock/dist/Socket.js", "holla/deps/protosock/dist/Socket.js");
require.alias("wearefractal-protosock/dist/util.js", "holla/deps/protosock/dist/util.js");
require.alias("wearefractal-protosock/dist/defaultClient.js", "holla/deps/protosock/dist/defaultClient.js");
require.alias("wearefractal-protosock/dist/Client.js", "holla/deps/protosock/dist/Client.js");
require.alias("wearefractal-protosock/dist/main.js", "holla/deps/protosock/index.js");
require.alias("component-emitter/index.js", "wearefractal-protosock/deps/emitter/index.js");
require.alias("component-indexof/index.js", "component-emitter/deps/indexof/index.js");

require.alias("LearnBoost-engine.io-client/lib/index.js", "wearefractal-protosock/deps/engine.io/lib/index.js");
require.alias("LearnBoost-engine.io-client/lib/socket.js", "wearefractal-protosock/deps/engine.io/lib/socket.js");
require.alias("LearnBoost-engine.io-client/lib/transport.js", "wearefractal-protosock/deps/engine.io/lib/transport.js");
require.alias("LearnBoost-engine.io-client/lib/emitter.js", "wearefractal-protosock/deps/engine.io/lib/emitter.js");
require.alias("LearnBoost-engine.io-client/lib/util.js", "wearefractal-protosock/deps/engine.io/lib/util.js");
require.alias("LearnBoost-engine.io-client/lib/transports/index.js", "wearefractal-protosock/deps/engine.io/lib/transports/index.js");
require.alias("LearnBoost-engine.io-client/lib/transports/polling.js", "wearefractal-protosock/deps/engine.io/lib/transports/polling.js");
require.alias("LearnBoost-engine.io-client/lib/transports/polling-xhr.js", "wearefractal-protosock/deps/engine.io/lib/transports/polling-xhr.js");
require.alias("LearnBoost-engine.io-client/lib/transports/polling-jsonp.js", "wearefractal-protosock/deps/engine.io/lib/transports/polling-jsonp.js");
require.alias("LearnBoost-engine.io-client/lib/transports/websocket.js", "wearefractal-protosock/deps/engine.io/lib/transports/websocket.js");
require.alias("LearnBoost-engine.io-client/lib/transports/flashsocket.js", "wearefractal-protosock/deps/engine.io/lib/transports/flashsocket.js");
require.alias("LearnBoost-engine.io-client/lib/index.js", "wearefractal-protosock/deps/engine.io/index.js");
require.alias("component-emitter/index.js", "LearnBoost-engine.io-client/deps/emitter/index.js");
require.alias("component-indexof/index.js", "component-emitter/deps/indexof/index.js");

require.alias("LearnBoost-engine.io-protocol/lib/index.js", "LearnBoost-engine.io-client/deps/engine.io-parser/lib/index.js");
require.alias("LearnBoost-engine.io-protocol/lib/keys.js", "LearnBoost-engine.io-client/deps/engine.io-parser/lib/keys.js");
require.alias("LearnBoost-engine.io-protocol/lib/index.js", "LearnBoost-engine.io-client/deps/engine.io-parser/index.js");
require.alias("LearnBoost-engine.io-protocol/lib/index.js", "LearnBoost-engine.io-protocol/index.js");

require.alias("visionmedia-debug/index.js", "LearnBoost-engine.io-client/deps/debug/index.js");
require.alias("visionmedia-debug/debug.js", "LearnBoost-engine.io-client/deps/debug/debug.js");

require.alias("LearnBoost-engine.io-client/lib/index.js", "LearnBoost-engine.io-client/index.js");

require.alias("wearefractal-protosock/dist/main.js", "wearefractal-protosock/index.js");

require.alias("component-emitter/index.js", "holla/deps/emitter/index.js");
require.alias("component-indexof/index.js", "component-emitter/deps/indexof/index.js");

require.alias("holla/dist/holla.js", "holla/index.js");

if (typeof exports == "object") {
  module.exports = require("holla");
} else if (typeof define == "function" && define.amd) {
  define(function(){ return require("holla"); });
} else {
  window["holla"] = require("holla");
}})();
