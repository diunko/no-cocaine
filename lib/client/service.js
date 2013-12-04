
exports.makeService = makeService
exports.bakeServiceProto = bakeServiceProto,
exports.Service = Service


var PROTOCOL_VERSION = 1

var __assert = require('assert')
var isIP = require('net').isIP
var dns = require('dns')

var BaseService = require('./base_service').BaseService

var methods = require('./methods/callback')
var Client = require('./client').Client

var client // = module.exports.client = new Client() // can't do this because
// of cyclic dependency client->service->client, so it's done in
// _resolve of serviceConnect routine

var trace = 1


function makeService(name, result, def){
  
  var proto = bakeServiceProto(name, result, def)
  proto.__proto__ = BaseService.prototype,

  Client.prototype = proto
  
  return Client
  
  function Client(){
    BaseService.apply(this, arguments)
    this._sessions = {}
  }
  
}


function bakeServiceProto(name, result, def, proto){
  
  var endpoint = result[0]
  var protocolVer = result[1]
  var methods = result[2]

  __assert(protocolVer === PROTOCOL_VERSION,
           'protocolVer === PROTOCOL_VERSION')

  proto = proto || {}
  proto._name = name
  proto._endpoint = endpoint
  
  for(var mid in methods){
    var _
    var methodName = methods[mid]
    mid = parseInt(mid)
    var M = ((_ = def.methods) && _[methodName]) || def.defaultMethod
    proto[methodName] = M(mid)
  }

  proto.__svcproto && (proto.__svcproto = undefined)
  
  return proto
}


function Service(name){

  function Service(){
    BaseService.apply(this, arguments)
    this._sessions = {}
    this._lookingup = false
    this._client = null
  }

  var proto = Service.prototype = {
    __proto__: BaseService.prototype,
    __svcproto: undefined,
    _name: name,
    connect: serviceConnect
  }

  proto.__svcproto = proto
  
  return Service
  
}

var baseServiceConnect = BaseService.prototype.connect

function serviceConnect(){
  var _this = this
  var done = false
  
  if(this._lookingup) return
  this._lookingup = true
  
  if(!this._endpoint){
    _resolve()
  } else {
    _checkIP()
  }

  function _resolve(){
    trace && console.log('_resolve', arguments)
    if(!this._client && client === undefined){
      client = new Client()
    }
    (this._client || client).resolve(_this._name, _resolveDone)
  }

  function _resolveDone(err, result){
    trace && console.log('_resolveDone', arguments)
    trace && console.log('svcproto',_this.__svcproto)
    if(err) return _handleError(err)
    var p = bakeServiceProto(_this._name, result,
                          {defaultMethod: methods.unpacking},
                          _this.__svcproto || _this.__proto__)
    trace && console.log('baked proto', p)
    _checkIP()
  }

  function _checkIP(){
    trace && console.log('_checkIP', _this._endpoint)
    if(Array.isArray(_this._endpoint) && !isIP(_this._endpoint[0])){
      trace && console.log('not ip:', _this._endpoint[0])
      dns.lookup(_this._endpoint[0], _lookupDone)
    } else {
      _connect()
    }
  }

  function _lookupDone(err, address, family){
    trace && console.log('_lookupDone', arguments)
    if(err) return _handleError(err)
    _this._endpoint[0] = address
    _connect()
  }

  function _handleError(err){
    trace && console.log('_handleError', arguments)
    if(!done){
      done = true
      _this.emit('error', err)
    } else {
      trace && console.log('_handleError called after done', arguments)
    }
  }
  
  function _connect(){
    trace && console.log('_connect')
    if(!done){
      done = true
      _this._lookingup = false
      baseServiceConnect.call(_this, _this._endpoint)
    } else {
      trace && console.log('_connect called after done')
    }
  }
}

