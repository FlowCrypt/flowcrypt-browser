var _excluded = ["name", "optional", "primitiveSchema"],
  _excluded2 = ["value"],
  _excluded3 = ["isHexOnly"],
  _excluded4 = ["value", "isIndefiniteForm"],
  _excluded5 = ["value"],
  _excluded6 = ["isConstructed"],
  _excluded7 = ["idBlock", "lenBlock"],
  _excluded8 = ["unusedBits", "isConstructed"],
  _excluded9 = ["idBlock", "lenBlock"],
  _excluded10 = ["value"],
  _excluded11 = ["valueDec", "isFirstSid"],
  _excluded12 = ["value"],
  _excluded13 = ["valueDec"],
  _excluded14 = ["value"],
  _excluded15 = ["value", "valueDate"],
  _excluded16 = ["value"],
  _excluded17 = ["value", "local"];
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _regeneratorRuntime() { "use strict"; _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }
function _construct(t, e, r) { if (_isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments); var o = [null]; o.push.apply(o, e); var p = new (t.bind.apply(t, o))(); return r && _setPrototypeOf(p, r.prototype), p; }
function _isNativeFunction(fn) { try { return Function.toString.call(fn).indexOf("[native code]") !== -1; } catch (e) { return typeof fn === "function"; } }
function _objectDestructuringEmpty(obj) { if (obj == null) throw new TypeError("Cannot destructure " + obj); }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }
function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _get() { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get.bind(); } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(arguments.length < 3 ? target : receiver); } return desc.value; }; } return _get.apply(this, arguments); }
function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }
function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }
function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }
function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var liner = function (exports, asmCrypto, elliptic) {
  'use strict';

  function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
      Object.keys(e).forEach(function (k) {
        if (k !== 'default') {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function get() {
              return e[k];
            }
          });
        }
      });
    }
    n.default = e;
    return Object.freeze(n);
  }
  function _mergeNamespaces(n, m) {
    m.forEach(function (e) {
      e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
        if (k !== 'default' && !(k in n)) {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function get() {
              return e[k];
            }
          });
        }
      });
    });
    return Object.freeze(n);
  }
  var asmCrypto__namespace = _interopNamespaceDefault(asmCrypto);
  var elliptic__namespace = _interopNamespaceDefault(elliptic);
  var window$2 = {};
  if (typeof self !== "undefined") {
    window$2 = self;
  }
  exports.nativeCrypto = window$2["msCrypto"] || window$2.crypto || {};
  exports.nativeSubtle = null;
  try {
    exports.nativeSubtle = (exports.nativeCrypto === null || exports.nativeCrypto === void 0 ? void 0 : exports.nativeCrypto.subtle) || (exports.nativeCrypto === null || exports.nativeCrypto === void 0 ? void 0 : exports.nativeCrypto["webkitSubtle"]) || null;
  } catch (err) {
    console.warn("Cannot get subtle from crypto", err);
  }
  function setCrypto(crypto) {
    exports.nativeCrypto = crypto;
    exports.nativeSubtle = crypto.subtle;
  }
  var ARRAY_BUFFER_NAME = "[object ArrayBuffer]";
  var BufferSourceConverter = function () {
    function BufferSourceConverter() {
      _classCallCheck(this, BufferSourceConverter);
    }
    _createClass(BufferSourceConverter, null, [{
      key: "isArrayBuffer",
      value: function isArrayBuffer(data) {
        return Object.prototype.toString.call(data) === ARRAY_BUFFER_NAME;
      }
    }, {
      key: "toArrayBuffer",
      value: function toArrayBuffer(data) {
        if (this.isArrayBuffer(data)) {
          return data;
        }
        if (data.byteLength === data.buffer.byteLength) {
          return data.buffer;
        }
        if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
          return data.buffer;
        }
        return this.toUint8Array(data.buffer).slice(data.byteOffset, data.byteOffset + data.byteLength).buffer;
      }
    }, {
      key: "toUint8Array",
      value: function toUint8Array(data) {
        return this.toView(data, Uint8Array);
      }
    }, {
      key: "toView",
      value: function toView(data, type) {
        if (data.constructor === type) {
          return data;
        }
        if (this.isArrayBuffer(data)) {
          return new type(data);
        }
        if (this.isArrayBufferView(data)) {
          return new type(data.buffer, data.byteOffset, data.byteLength);
        }
        throw new TypeError("The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
      }
    }, {
      key: "isBufferSource",
      value: function isBufferSource(data) {
        return this.isArrayBufferView(data) || this.isArrayBuffer(data);
      }
    }, {
      key: "isArrayBufferView",
      value: function isArrayBufferView(data) {
        return ArrayBuffer.isView(data) || data && this.isArrayBuffer(data.buffer);
      }
    }, {
      key: "isEqual",
      value: function isEqual(a, b) {
        var aView = BufferSourceConverter.toUint8Array(a);
        var bView = BufferSourceConverter.toUint8Array(b);
        if (aView.length !== bView.byteLength) {
          return false;
        }
        for (var i = 0; i < aView.length; i++) {
          if (aView[i] !== bView[i]) {
            return false;
          }
        }
        return true;
      }
    }, {
      key: "concat",
      value: function concat() {
        var buffers;
        for (var _len = arguments.length, args = new Array(_len), _key2 = 0; _key2 < _len; _key2++) {
          args[_key2] = arguments[_key2];
        }
        if (Array.isArray(args[0]) && !(args[1] instanceof Function)) {
          buffers = args[0];
        } else if (Array.isArray(args[0]) && args[1] instanceof Function) {
          buffers = args[0];
        } else {
          if (args[args.length - 1] instanceof Function) {
            buffers = args.slice(0, args.length - 1);
          } else {
            buffers = args;
          }
        }
        var size = 0;
        var _iterator = _createForOfIteratorHelper(buffers),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var buffer = _step.value;
            size += buffer.byteLength;
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        var res = new Uint8Array(size);
        var offset = 0;
        var _iterator2 = _createForOfIteratorHelper(buffers),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var _buffer2 = _step2.value;
            var view = this.toUint8Array(_buffer2);
            res.set(view, offset);
            offset += view.length;
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
        if (args[args.length - 1] instanceof Function) {
          return this.toView(res, args[args.length - 1]);
        }
        return res.buffer;
      }
    }]);
    return BufferSourceConverter;
  }();
  var STRING_TYPE = "string";
  var HEX_REGEX = /^[0-9a-f]+$/i;
  var BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  var BASE64URL_REGEX = /^[a-zA-Z0-9-_]+$/;
  var Utf8Converter = function () {
    function Utf8Converter() {
      _classCallCheck(this, Utf8Converter);
    }
    _createClass(Utf8Converter, null, [{
      key: "fromString",
      value: function fromString(text) {
        var s = unescape(encodeURIComponent(text));
        var uintArray = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) {
          uintArray[i] = s.charCodeAt(i);
        }
        return uintArray.buffer;
      }
    }, {
      key: "toString",
      value: function toString(buffer) {
        var buf = BufferSourceConverter.toUint8Array(buffer);
        var encodedString = "";
        for (var i = 0; i < buf.length; i++) {
          encodedString += String.fromCharCode(buf[i]);
        }
        var decodedString = decodeURIComponent(escape(encodedString));
        return decodedString;
      }
    }]);
    return Utf8Converter;
  }();
  var Utf16Converter = function () {
    function Utf16Converter() {
      _classCallCheck(this, Utf16Converter);
    }
    _createClass(Utf16Converter, null, [{
      key: "toString",
      value: function toString(buffer) {
        var littleEndian = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var arrayBuffer = BufferSourceConverter.toArrayBuffer(buffer);
        var dataView = new DataView(arrayBuffer);
        var res = "";
        for (var i = 0; i < arrayBuffer.byteLength; i += 2) {
          var code = dataView.getUint16(i, littleEndian);
          res += String.fromCharCode(code);
        }
        return res;
      }
    }, {
      key: "fromString",
      value: function fromString(text) {
        var littleEndian = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var res = new ArrayBuffer(text.length * 2);
        var dataView = new DataView(res);
        for (var i = 0; i < text.length; i++) {
          dataView.setUint16(i * 2, text.charCodeAt(i), littleEndian);
        }
        return res;
      }
    }]);
    return Utf16Converter;
  }();
  var Convert = function () {
    function Convert() {
      _classCallCheck(this, Convert);
    }
    _createClass(Convert, null, [{
      key: "isHex",
      value: function isHex(data) {
        return _typeof(data) === STRING_TYPE && HEX_REGEX.test(data);
      }
    }, {
      key: "isBase64",
      value: function isBase64(data) {
        return _typeof(data) === STRING_TYPE && BASE64_REGEX.test(data);
      }
    }, {
      key: "isBase64Url",
      value: function isBase64Url(data) {
        return _typeof(data) === STRING_TYPE && BASE64URL_REGEX.test(data);
      }
    }, {
      key: "ToString",
      value: function ToString(buffer) {
        var enc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "utf8";
        var buf = BufferSourceConverter.toUint8Array(buffer);
        switch (enc.toLowerCase()) {
          case "utf8":
            return this.ToUtf8String(buf);
          case "binary":
            return this.ToBinary(buf);
          case "hex":
            return this.ToHex(buf);
          case "base64":
            return this.ToBase64(buf);
          case "base64url":
            return this.ToBase64Url(buf);
          case "utf16le":
            return Utf16Converter.toString(buf, true);
          case "utf16":
          case "utf16be":
            return Utf16Converter.toString(buf);
          default:
            throw new Error("Unknown type of encoding '".concat(enc, "'"));
        }
      }
    }, {
      key: "FromString",
      value: function FromString(str) {
        var enc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "utf8";
        if (!str) {
          return new ArrayBuffer(0);
        }
        switch (enc.toLowerCase()) {
          case "utf8":
            return this.FromUtf8String(str);
          case "binary":
            return this.FromBinary(str);
          case "hex":
            return this.FromHex(str);
          case "base64":
            return this.FromBase64(str);
          case "base64url":
            return this.FromBase64Url(str);
          case "utf16le":
            return Utf16Converter.fromString(str, true);
          case "utf16":
          case "utf16be":
            return Utf16Converter.fromString(str);
          default:
            throw new Error("Unknown type of encoding '".concat(enc, "'"));
        }
      }
    }, {
      key: "ToBase64",
      value: function ToBase64(buffer) {
        var buf = BufferSourceConverter.toUint8Array(buffer);
        if (typeof btoa !== "undefined") {
          var _binary = this.ToString(buf, "binary");
          return btoa(_binary);
        } else {
          return Buffer.from(buf).toString("base64");
        }
      }
    }, {
      key: "FromBase64",
      value: function FromBase64(base64) {
        var formatted = this.formatString(base64);
        if (!formatted) {
          return new ArrayBuffer(0);
        }
        if (!Convert.isBase64(formatted)) {
          throw new TypeError("Argument 'base64Text' is not Base64 encoded");
        }
        if (typeof atob !== "undefined") {
          return this.FromBinary(atob(formatted));
        } else {
          return new Uint8Array(Buffer.from(formatted, "base64")).buffer;
        }
      }
    }, {
      key: "FromBase64Url",
      value: function FromBase64Url(base64url) {
        var formatted = this.formatString(base64url);
        if (!formatted) {
          return new ArrayBuffer(0);
        }
        if (!Convert.isBase64Url(formatted)) {
          throw new TypeError("Argument 'base64url' is not Base64Url encoded");
        }
        return this.FromBase64(this.Base64Padding(formatted.replace(/\-/g, "+").replace(/\_/g, "/")));
      }
    }, {
      key: "ToBase64Url",
      value: function ToBase64Url(data) {
        return this.ToBase64(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
      }
    }, {
      key: "FromUtf8String",
      value: function FromUtf8String(text) {
        var encoding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Convert.DEFAULT_UTF8_ENCODING;
        switch (encoding) {
          case "ascii":
            return this.FromBinary(text);
          case "utf8":
            return Utf8Converter.fromString(text);
          case "utf16":
          case "utf16be":
            return Utf16Converter.fromString(text);
          case "utf16le":
          case "usc2":
            return Utf16Converter.fromString(text, true);
          default:
            throw new Error("Unknown type of encoding '".concat(encoding, "'"));
        }
      }
    }, {
      key: "ToUtf8String",
      value: function ToUtf8String(buffer) {
        var encoding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Convert.DEFAULT_UTF8_ENCODING;
        switch (encoding) {
          case "ascii":
            return this.ToBinary(buffer);
          case "utf8":
            return Utf8Converter.toString(buffer);
          case "utf16":
          case "utf16be":
            return Utf16Converter.toString(buffer);
          case "utf16le":
          case "usc2":
            return Utf16Converter.toString(buffer, true);
          default:
            throw new Error("Unknown type of encoding '".concat(encoding, "'"));
        }
      }
    }, {
      key: "FromBinary",
      value: function FromBinary(text) {
        var stringLength = text.length;
        var resultView = new Uint8Array(stringLength);
        for (var i = 0; i < stringLength; i++) {
          resultView[i] = text.charCodeAt(i);
        }
        return resultView.buffer;
      }
    }, {
      key: "ToBinary",
      value: function ToBinary(buffer) {
        var buf = BufferSourceConverter.toUint8Array(buffer);
        var res = "";
        for (var i = 0; i < buf.length; i++) {
          res += String.fromCharCode(buf[i]);
        }
        return res;
      }
    }, {
      key: "ToHex",
      value: function ToHex(buffer) {
        var buf = BufferSourceConverter.toUint8Array(buffer);
        var result = "";
        var len = buf.length;
        for (var i = 0; i < len; i++) {
          var byte = buf[i];
          if (byte < 16) {
            result += "0";
          }
          result += byte.toString(16);
        }
        return result;
      }
    }, {
      key: "FromHex",
      value: function FromHex(hexString) {
        var formatted = this.formatString(hexString);
        if (!formatted) {
          return new ArrayBuffer(0);
        }
        if (!Convert.isHex(formatted)) {
          throw new TypeError("Argument 'hexString' is not HEX encoded");
        }
        if (formatted.length % 2) {
          formatted = "0".concat(formatted);
        }
        var res = new Uint8Array(formatted.length / 2);
        for (var i = 0; i < formatted.length; i = i + 2) {
          var c = formatted.slice(i, i + 2);
          res[i / 2] = parseInt(c, 16);
        }
        return res.buffer;
      }
    }, {
      key: "ToUtf16String",
      value: function ToUtf16String(buffer) {
        var littleEndian = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        return Utf16Converter.toString(buffer, littleEndian);
      }
    }, {
      key: "FromUtf16String",
      value: function FromUtf16String(text) {
        var littleEndian = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        return Utf16Converter.fromString(text, littleEndian);
      }
    }, {
      key: "Base64Padding",
      value: function Base64Padding(base64) {
        var padCount = 4 - base64.length % 4;
        if (padCount < 4) {
          for (var i = 0; i < padCount; i++) {
            base64 += "=";
          }
        }
        return base64;
      }
    }, {
      key: "formatString",
      value: function formatString(data) {
        return (data === null || data === void 0 ? void 0 : data.replace(/[\n\r\t ]/g, "")) || "";
      }
    }]);
    return Convert;
  }();
  Convert.DEFAULT_UTF8_ENCODING = "utf8";
  function combine() {
    for (var _len2 = arguments.length, buf = new Array(_len2), _key3 = 0; _key3 < _len2; _key3++) {
      buf[_key3] = arguments[_key3];
    }
    var totalByteLength = buf.map(function (item) {
      return item.byteLength;
    }).reduce(function (prev, cur) {
      return prev + cur;
    });
    var res = new Uint8Array(totalByteLength);
    var currentPos = 0;
    buf.map(function (item) {
      return new Uint8Array(item);
    }).forEach(function (arr) {
      var _iterator3 = _createForOfIteratorHelper(arr),
        _step3;
      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var item2 = _step3.value;
          res[currentPos++] = item2;
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
    });
    return res.buffer;
  }
  function utilFromBase(inputBuffer, inputBase) {
    var result = 0;
    if (inputBuffer.length === 1) {
      return inputBuffer[0];
    }
    for (var i = inputBuffer.length - 1; i >= 0; i--) {
      result += inputBuffer[inputBuffer.length - 1 - i] * Math.pow(2, inputBase * i);
    }
    return result;
  }
  function utilToBase(value, base) {
    var reserved = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    var internalReserved = reserved;
    var internalValue = value;
    var result = 0;
    var biggest = Math.pow(2, base);
    for (var i = 1; i < 8; i++) {
      if (value < biggest) {
        var retBuf = void 0;
        if (internalReserved < 0) {
          retBuf = new ArrayBuffer(i);
          result = i;
        } else {
          if (internalReserved < i) {
            return new ArrayBuffer(0);
          }
          retBuf = new ArrayBuffer(internalReserved);
          result = internalReserved;
        }
        var retView = new Uint8Array(retBuf);
        for (var j = i - 1; j >= 0; j--) {
          var basis = Math.pow(2, j * base);
          retView[result - j - 1] = Math.floor(internalValue / basis);
          internalValue -= retView[result - j - 1] * basis;
        }
        return retBuf;
      }
      biggest *= Math.pow(2, base);
    }
    return new ArrayBuffer(0);
  }
  function utilConcatView() {
    var outputLength = 0;
    var prevLength = 0;
    for (var _len3 = arguments.length, views = new Array(_len3), _key4 = 0; _key4 < _len3; _key4++) {
      views[_key4] = arguments[_key4];
    }
    for (var _i = 0, _views = views; _i < _views.length; _i++) {
      var view = _views[_i];
      outputLength += view.length;
    }
    var retBuf = new ArrayBuffer(outputLength);
    var retView = new Uint8Array(retBuf);
    for (var _i2 = 0, _views2 = views; _i2 < _views2.length; _i2++) {
      var _view = _views2[_i2];
      retView.set(_view, prevLength);
      prevLength += _view.length;
    }
    return retView;
  }
  function utilDecodeTC() {
    var buf = new Uint8Array(this.valueHex);
    if (this.valueHex.byteLength >= 2) {
      var condition1 = buf[0] === 0xFF && buf[1] & 0x80;
      var condition2 = buf[0] === 0x00 && (buf[1] & 0x80) === 0x00;
      if (condition1 || condition2) {
        this.warnings.push("Needlessly long format");
      }
    }
    var bigIntBuffer = new ArrayBuffer(this.valueHex.byteLength);
    var bigIntView = new Uint8Array(bigIntBuffer);
    for (var i = 0; i < this.valueHex.byteLength; i++) {
      bigIntView[i] = 0;
    }
    bigIntView[0] = buf[0] & 0x80;
    var bigInt = utilFromBase(bigIntView, 8);
    var smallIntBuffer = new ArrayBuffer(this.valueHex.byteLength);
    var smallIntView = new Uint8Array(smallIntBuffer);
    for (var j = 0; j < this.valueHex.byteLength; j++) {
      smallIntView[j] = buf[j];
    }
    smallIntView[0] &= 0x7F;
    var smallInt = utilFromBase(smallIntView, 8);
    return smallInt - bigInt;
  }
  function utilEncodeTC(value) {
    var modValue = value < 0 ? value * -1 : value;
    var bigInt = 128;
    for (var i = 1; i < 8; i++) {
      if (modValue <= bigInt) {
        if (value < 0) {
          var smallInt = bigInt - modValue;
          var _retBuf = utilToBase(smallInt, 8, i);
          var _retView = new Uint8Array(_retBuf);
          _retView[0] |= 0x80;
          return _retBuf;
        }
        var retBuf = utilToBase(modValue, 8, i);
        var retView = new Uint8Array(retBuf);
        if (retView[0] & 0x80) {
          var tempBuf = retBuf.slice(0);
          var tempView = new Uint8Array(tempBuf);
          retBuf = new ArrayBuffer(retBuf.byteLength + 1);
          retView = new Uint8Array(retBuf);
          for (var k = 0; k < tempBuf.byteLength; k++) {
            retView[k + 1] = tempView[k];
          }
          retView[0] = 0x00;
        }
        return retBuf;
      }
      bigInt *= Math.pow(2, 8);
    }
    return new ArrayBuffer(0);
  }
  function isEqualBuffer(inputBuffer1, inputBuffer2) {
    if (inputBuffer1.byteLength !== inputBuffer2.byteLength) {
      return false;
    }
    var view1 = new Uint8Array(inputBuffer1);
    var view2 = new Uint8Array(inputBuffer2);
    for (var i = 0; i < view1.length; i++) {
      if (view1[i] !== view2[i]) {
        return false;
      }
    }
    return true;
  }
  function padNumber(inputNumber, fullLength) {
    var str = inputNumber.toString(10);
    if (fullLength < str.length) {
      return "";
    }
    var dif = fullLength - str.length;
    var padding = new Array(dif);
    for (var i = 0; i < dif; i++) {
      padding[i] = "0";
    }
    var paddingString = padding.join("");
    return paddingString.concat(str);
  }
  function assertBigInt() {
    if (typeof BigInt === "undefined") {
      throw new Error("BigInt is not defined. Your environment doesn't implement BigInt.");
    }
  }
  function concat$1(buffers) {
    var outputLength = 0;
    var prevLength = 0;
    for (var i = 0; i < buffers.length; i++) {
      var buffer = buffers[i];
      outputLength += buffer.byteLength;
    }
    var retView = new Uint8Array(outputLength);
    for (var _i3 = 0; _i3 < buffers.length; _i3++) {
      var _buffer3 = buffers[_i3];
      retView.set(new Uint8Array(_buffer3), prevLength);
      prevLength += _buffer3.byteLength;
    }
    return retView.buffer;
  }
  function checkBufferParams(baseBlock, inputBuffer, inputOffset, inputLength) {
    if (!(inputBuffer instanceof Uint8Array)) {
      baseBlock.error = "Wrong parameter: inputBuffer must be 'Uint8Array'";
      return false;
    }
    if (!inputBuffer.byteLength) {
      baseBlock.error = "Wrong parameter: inputBuffer has zero length";
      return false;
    }
    if (inputOffset < 0) {
      baseBlock.error = "Wrong parameter: inputOffset less than zero";
      return false;
    }
    if (inputLength < 0) {
      baseBlock.error = "Wrong parameter: inputLength less than zero";
      return false;
    }
    if (inputBuffer.byteLength - inputOffset - inputLength < 0) {
      baseBlock.error = "End of input reached before message was fully decoded (inconsistent offset and length values)";
      return false;
    }
    return true;
  }
  var ViewWriter = function () {
    function ViewWriter() {
      _classCallCheck(this, ViewWriter);
      this.items = [];
    }
    _createClass(ViewWriter, [{
      key: "write",
      value: function write(buf) {
        this.items.push(buf);
      }
    }, {
      key: "final",
      value: function final() {
        return concat$1(this.items);
      }
    }]);
    return ViewWriter;
  }();
  var powers2 = [new Uint8Array([1])];
  var digitsString = "0123456789";
  var NAME = "name";
  var VALUE_HEX_VIEW = "valueHexView";
  var IS_HEX_ONLY = "isHexOnly";
  var ID_BLOCK = "idBlock";
  var TAG_CLASS = "tagClass";
  var TAG_NUMBER = "tagNumber";
  var IS_CONSTRUCTED = "isConstructed";
  var FROM_BER = "fromBER";
  var TO_BER = "toBER";
  var LOCAL = "local";
  var EMPTY_STRING = "";
  var EMPTY_BUFFER = new ArrayBuffer(0);
  var EMPTY_VIEW = new Uint8Array(0);
  var END_OF_CONTENT_NAME = "EndOfContent";
  var OCTET_STRING_NAME = "OCTET STRING";
  var BIT_STRING_NAME = "BIT STRING";
  function HexBlock(BaseClass) {
    var _a;
    return _a = function (_BaseClass) {
      _inherits(Some, _BaseClass);
      function Some() {
        var _this2;
        _classCallCheck(this, Some);
        var _a;
        for (var _len4 = arguments.length, args = new Array(_len4), _key5 = 0; _key5 < _len4; _key5++) {
          args[_key5] = arguments[_key5];
        }
        _this2 = _callSuper(this, Some, [].concat(args));
        var params = args[0] || {};
        _this2.isHexOnly = (_a = params.isHexOnly) !== null && _a !== void 0 ? _a : false;
        _this2.valueHexView = params.valueHex ? BufferSourceConverter.toUint8Array(params.valueHex) : EMPTY_VIEW;
        return _this2;
      }
      _createClass(Some, [{
        key: "valueHex",
        get: function get() {
          return this.valueHexView.slice().buffer;
        },
        set: function set(value) {
          this.valueHexView = new Uint8Array(value);
        }
      }, {
        key: "fromBER",
        value: function fromBER(inputBuffer, inputOffset, inputLength) {
          var view = inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer;
          if (!checkBufferParams(this, view, inputOffset, inputLength)) {
            return -1;
          }
          var endLength = inputOffset + inputLength;
          this.valueHexView = view.subarray(inputOffset, endLength);
          if (!this.valueHexView.length) {
            this.warnings.push("Zero buffer length");
            return inputOffset;
          }
          this.blockLength = inputLength;
          return endLength;
        }
      }, {
        key: "toBER",
        value: function toBER() {
          var sizeOnly = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
          if (!this.isHexOnly) {
            this.error = "Flag 'isHexOnly' is not set, abort";
            return EMPTY_BUFFER;
          }
          if (sizeOnly) {
            return new ArrayBuffer(this.valueHexView.byteLength);
          }
          return this.valueHexView.byteLength === this.valueHexView.buffer.byteLength ? this.valueHexView.buffer : this.valueHexView.slice().buffer;
        }
      }, {
        key: "toJSON",
        value: function toJSON() {
          return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(Some.prototype), "toJSON", this).call(this)), {}, {
            isHexOnly: this.isHexOnly,
            valueHex: Convert.ToHex(this.valueHexView)
          });
        }
      }]);
      return Some;
    }(BaseClass), _a.NAME = "hexBlock", _a;
  }
  var LocalBaseBlock = function () {
    function LocalBaseBlock() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$blockLength = _ref.blockLength,
        blockLength = _ref$blockLength === void 0 ? 0 : _ref$blockLength,
        _ref$error = _ref.error,
        error = _ref$error === void 0 ? EMPTY_STRING : _ref$error,
        _ref$warnings = _ref.warnings,
        warnings = _ref$warnings === void 0 ? [] : _ref$warnings,
        _ref$valueBeforeDecod = _ref.valueBeforeDecode,
        valueBeforeDecode = _ref$valueBeforeDecod === void 0 ? EMPTY_VIEW : _ref$valueBeforeDecod;
      _classCallCheck(this, LocalBaseBlock);
      this.blockLength = blockLength;
      this.error = error;
      this.warnings = warnings;
      this.valueBeforeDecodeView = BufferSourceConverter.toUint8Array(valueBeforeDecode);
    }
    _createClass(LocalBaseBlock, [{
      key: "valueBeforeDecode",
      get: function get() {
        return this.valueBeforeDecodeView.slice().buffer;
      },
      set: function set(value) {
        this.valueBeforeDecodeView = new Uint8Array(value);
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return {
          blockName: this.constructor.NAME,
          blockLength: this.blockLength,
          error: this.error,
          warnings: this.warnings,
          valueBeforeDecode: Convert.ToHex(this.valueBeforeDecodeView)
        };
      }
    }], [{
      key: "blockName",
      value: function blockName() {
        return this.NAME;
      }
    }]);
    return LocalBaseBlock;
  }();
  LocalBaseBlock.NAME = "baseBlock";
  var ValueBlock = function (_LocalBaseBlock) {
    _inherits(ValueBlock, _LocalBaseBlock);
    function ValueBlock() {
      _classCallCheck(this, ValueBlock);
      return _callSuper(this, ValueBlock, arguments);
    }
    _createClass(ValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        throw TypeError("User need to make a specific function in a class which extends 'ValueBlock'");
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        throw TypeError("User need to make a specific function in a class which extends 'ValueBlock'");
      }
    }]);
    return ValueBlock;
  }(LocalBaseBlock);
  ValueBlock.NAME = "valueBlock";
  var LocalIdentificationBlock = function (_HexBlock) {
    _inherits(LocalIdentificationBlock, _HexBlock);
    function LocalIdentificationBlock() {
      var _this3;
      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref2$idBlock = _ref2.idBlock,
        idBlock = _ref2$idBlock === void 0 ? {} : _ref2$idBlock;
      _classCallCheck(this, LocalIdentificationBlock);
      var _a, _b, _c, _d;
      _this3 = _callSuper(this, LocalIdentificationBlock);
      if (idBlock) {
        _this3.isHexOnly = (_a = idBlock.isHexOnly) !== null && _a !== void 0 ? _a : false;
        _this3.valueHexView = idBlock.valueHex ? BufferSourceConverter.toUint8Array(idBlock.valueHex) : EMPTY_VIEW;
        _this3.tagClass = (_b = idBlock.tagClass) !== null && _b !== void 0 ? _b : -1;
        _this3.tagNumber = (_c = idBlock.tagNumber) !== null && _c !== void 0 ? _c : -1;
        _this3.isConstructed = (_d = idBlock.isConstructed) !== null && _d !== void 0 ? _d : false;
      } else {
        _this3.tagClass = -1;
        _this3.tagNumber = -1;
        _this3.isConstructed = false;
      }
      return _this3;
    }
    _createClass(LocalIdentificationBlock, [{
      key: "toBER",
      value: function toBER() {
        var sizeOnly = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
        var firstOctet = 0;
        switch (this.tagClass) {
          case 1:
            firstOctet |= 0x00;
            break;
          case 2:
            firstOctet |= 0x40;
            break;
          case 3:
            firstOctet |= 0x80;
            break;
          case 4:
            firstOctet |= 0xC0;
            break;
          default:
            this.error = "Unknown tag class";
            return EMPTY_BUFFER;
        }
        if (this.isConstructed) firstOctet |= 0x20;
        if (this.tagNumber < 31 && !this.isHexOnly) {
          var _retView2 = new Uint8Array(1);
          if (!sizeOnly) {
            var number = this.tagNumber;
            number &= 0x1F;
            firstOctet |= number;
            _retView2[0] = firstOctet;
          }
          return _retView2.buffer;
        }
        if (!this.isHexOnly) {
          var encodedBuf = utilToBase(this.tagNumber, 7);
          var encodedView = new Uint8Array(encodedBuf);
          var size = encodedBuf.byteLength;
          var _retView3 = new Uint8Array(size + 1);
          _retView3[0] = firstOctet | 0x1F;
          if (!sizeOnly) {
            for (var i = 0; i < size - 1; i++) _retView3[i + 1] = encodedView[i] | 0x80;
            _retView3[size] = encodedView[size - 1];
          }
          return _retView3.buffer;
        }
        var retView = new Uint8Array(this.valueHexView.byteLength + 1);
        retView[0] = firstOctet | 0x1F;
        if (!sizeOnly) {
          var curView = this.valueHexView;
          for (var _i4 = 0; _i4 < curView.length - 1; _i4++) retView[_i4 + 1] = curView[_i4] | 0x80;
          retView[this.valueHexView.byteLength] = curView[curView.length - 1];
        }
        return retView.buffer;
      }
    }, {
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
          return -1;
        }
        var intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        if (intBuffer.length === 0) {
          this.error = "Zero buffer length";
          return -1;
        }
        var tagClassMask = intBuffer[0] & 0xC0;
        switch (tagClassMask) {
          case 0x00:
            this.tagClass = 1;
            break;
          case 0x40:
            this.tagClass = 2;
            break;
          case 0x80:
            this.tagClass = 3;
            break;
          case 0xC0:
            this.tagClass = 4;
            break;
          default:
            this.error = "Unknown tag class";
            return -1;
        }
        this.isConstructed = (intBuffer[0] & 0x20) === 0x20;
        this.isHexOnly = false;
        var tagNumberMask = intBuffer[0] & 0x1F;
        if (tagNumberMask !== 0x1F) {
          this.tagNumber = tagNumberMask;
          this.blockLength = 1;
        } else {
          var count = 1;
          var intTagNumberBuffer = this.valueHexView = new Uint8Array(255);
          var tagNumberBufferMaxLength = 255;
          while (intBuffer[count] & 0x80) {
            intTagNumberBuffer[count - 1] = intBuffer[count] & 0x7F;
            count++;
            if (count >= intBuffer.length) {
              this.error = "End of input reached before message was fully decoded";
              return -1;
            }
            if (count === tagNumberBufferMaxLength) {
              tagNumberBufferMaxLength += 255;
              var _tempBufferView = new Uint8Array(tagNumberBufferMaxLength);
              for (var i = 0; i < intTagNumberBuffer.length; i++) _tempBufferView[i] = intTagNumberBuffer[i];
              intTagNumberBuffer = this.valueHexView = new Uint8Array(tagNumberBufferMaxLength);
            }
          }
          this.blockLength = count + 1;
          intTagNumberBuffer[count - 1] = intBuffer[count] & 0x7F;
          var tempBufferView = new Uint8Array(count);
          for (var _i5 = 0; _i5 < count; _i5++) tempBufferView[_i5] = intTagNumberBuffer[_i5];
          intTagNumberBuffer = this.valueHexView = new Uint8Array(count);
          intTagNumberBuffer.set(tempBufferView);
          if (this.blockLength <= 9) this.tagNumber = utilFromBase(intTagNumberBuffer, 7);else {
            this.isHexOnly = true;
            this.warnings.push("Tag too long, represented as hex-coded");
          }
        }
        if (this.tagClass === 1 && this.isConstructed) {
          switch (this.tagNumber) {
            case 1:
            case 2:
            case 5:
            case 6:
            case 9:
            case 13:
            case 14:
            case 23:
            case 24:
            case 31:
            case 32:
            case 33:
            case 34:
              this.error = "Constructed encoding used for primitive type";
              return -1;
          }
        }
        return inputOffset + this.blockLength;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalIdentificationBlock.prototype), "toJSON", this).call(this)), {}, {
          tagClass: this.tagClass,
          tagNumber: this.tagNumber,
          isConstructed: this.isConstructed
        });
      }
    }]);
    return LocalIdentificationBlock;
  }(HexBlock(LocalBaseBlock));
  LocalIdentificationBlock.NAME = "identificationBlock";
  var LocalLengthBlock = function (_LocalBaseBlock2) {
    _inherits(LocalLengthBlock, _LocalBaseBlock2);
    function LocalLengthBlock() {
      var _this4;
      var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref3$lenBlock = _ref3.lenBlock,
        lenBlock = _ref3$lenBlock === void 0 ? {} : _ref3$lenBlock;
      _classCallCheck(this, LocalLengthBlock);
      var _a, _b, _c;
      _this4 = _callSuper(this, LocalLengthBlock);
      _this4.isIndefiniteForm = (_a = lenBlock.isIndefiniteForm) !== null && _a !== void 0 ? _a : false;
      _this4.longFormUsed = (_b = lenBlock.longFormUsed) !== null && _b !== void 0 ? _b : false;
      _this4.length = (_c = lenBlock.length) !== null && _c !== void 0 ? _c : 0;
      return _this4;
    }
    _createClass(LocalLengthBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var view = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, view, inputOffset, inputLength)) {
          return -1;
        }
        var intBuffer = view.subarray(inputOffset, inputOffset + inputLength);
        if (intBuffer.length === 0) {
          this.error = "Zero buffer length";
          return -1;
        }
        if (intBuffer[0] === 0xFF) {
          this.error = "Length block 0xFF is reserved by standard";
          return -1;
        }
        this.isIndefiniteForm = intBuffer[0] === 0x80;
        if (this.isIndefiniteForm) {
          this.blockLength = 1;
          return inputOffset + this.blockLength;
        }
        this.longFormUsed = !!(intBuffer[0] & 0x80);
        if (this.longFormUsed === false) {
          this.length = intBuffer[0];
          this.blockLength = 1;
          return inputOffset + this.blockLength;
        }
        var count = intBuffer[0] & 0x7F;
        if (count > 8) {
          this.error = "Too big integer";
          return -1;
        }
        if (count + 1 > intBuffer.length) {
          this.error = "End of input reached before message was fully decoded";
          return -1;
        }
        var lenOffset = inputOffset + 1;
        var lengthBufferView = view.subarray(lenOffset, lenOffset + count);
        if (lengthBufferView[count - 1] === 0x00) this.warnings.push("Needlessly long encoded length");
        this.length = utilFromBase(lengthBufferView, 8);
        if (this.longFormUsed && this.length <= 127) this.warnings.push("Unnecessary usage of long length form");
        this.blockLength = count + 1;
        return inputOffset + this.blockLength;
      }
    }, {
      key: "toBER",
      value: function toBER() {
        var sizeOnly = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
        var retBuf;
        var retView;
        if (this.length > 127) this.longFormUsed = true;
        if (this.isIndefiniteForm) {
          retBuf = new ArrayBuffer(1);
          if (sizeOnly === false) {
            retView = new Uint8Array(retBuf);
            retView[0] = 0x80;
          }
          return retBuf;
        }
        if (this.longFormUsed) {
          var encodedBuf = utilToBase(this.length, 8);
          if (encodedBuf.byteLength > 127) {
            this.error = "Too big length";
            return EMPTY_BUFFER;
          }
          retBuf = new ArrayBuffer(encodedBuf.byteLength + 1);
          if (sizeOnly) return retBuf;
          var encodedView = new Uint8Array(encodedBuf);
          retView = new Uint8Array(retBuf);
          retView[0] = encodedBuf.byteLength | 0x80;
          for (var i = 0; i < encodedBuf.byteLength; i++) retView[i + 1] = encodedView[i];
          return retBuf;
        }
        retBuf = new ArrayBuffer(1);
        if (sizeOnly === false) {
          retView = new Uint8Array(retBuf);
          retView[0] = this.length;
        }
        return retBuf;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalLengthBlock.prototype), "toJSON", this).call(this)), {}, {
          isIndefiniteForm: this.isIndefiniteForm,
          longFormUsed: this.longFormUsed,
          length: this.length
        });
      }
    }]);
    return LocalLengthBlock;
  }(LocalBaseBlock);
  LocalLengthBlock.NAME = "lengthBlock";
  var typeStore = {};
  var BaseBlock = function (_LocalBaseBlock3) {
    _inherits(BaseBlock, _LocalBaseBlock3);
    function BaseBlock() {
      var _this5;
      var _ref4 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref4$name = _ref4.name,
        name = _ref4$name === void 0 ? EMPTY_STRING : _ref4$name,
        _ref4$optional = _ref4.optional,
        optional = _ref4$optional === void 0 ? false : _ref4$optional,
        primitiveSchema = _ref4.primitiveSchema,
        parameters = _objectWithoutProperties(_ref4, _excluded);
      var valueBlockType = arguments.length > 1 ? arguments[1] : undefined;
      _classCallCheck(this, BaseBlock);
      _this5 = _callSuper(this, BaseBlock, [parameters]);
      _this5.name = name;
      _this5.optional = optional;
      if (primitiveSchema) {
        _this5.primitiveSchema = primitiveSchema;
      }
      _this5.idBlock = new LocalIdentificationBlock(parameters);
      _this5.lenBlock = new LocalLengthBlock(parameters);
      _this5.valueBlock = valueBlockType ? new valueBlockType(parameters) : new ValueBlock(parameters);
      return _this5;
    }
    _createClass(BaseBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, this.lenBlock.isIndefiniteForm ? inputLength : this.lenBlock.length);
        if (resultOffset === -1) {
          this.error = this.valueBlock.error;
          return resultOffset;
        }
        if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
        if (!this.valueBlock.error.length) this.blockLength += this.valueBlock.blockLength;
        return resultOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        var _writer = writer || new ViewWriter();
        if (!writer) {
          prepareIndefiniteForm(this);
        }
        var idBlockBuf = this.idBlock.toBER(sizeOnly);
        _writer.write(idBlockBuf);
        if (this.lenBlock.isIndefiniteForm) {
          _writer.write(new Uint8Array([0x80]).buffer);
          this.valueBlock.toBER(sizeOnly, _writer);
          _writer.write(new ArrayBuffer(2));
        } else {
          var valueBlockBuf = this.valueBlock.toBER(sizeOnly);
          this.lenBlock.length = valueBlockBuf.byteLength;
          var lenBlockBuf = this.lenBlock.toBER(sizeOnly);
          _writer.write(lenBlockBuf);
          _writer.write(valueBlockBuf);
        }
        if (!writer) {
          return _writer.final();
        }
        return EMPTY_BUFFER;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        var object = _objectSpread(_objectSpread({}, _get(_getPrototypeOf(BaseBlock.prototype), "toJSON", this).call(this)), {}, {
          idBlock: this.idBlock.toJSON(),
          lenBlock: this.lenBlock.toJSON(),
          valueBlock: this.valueBlock.toJSON(),
          name: this.name,
          optional: this.optional
        });
        if (this.primitiveSchema) object.primitiveSchema = this.primitiveSchema.toJSON();
        return object;
      }
    }, {
      key: "toString",
      value: function toString() {
        var encoding = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "ascii";
        if (encoding === "ascii") {
          return this.onAsciiEncoding();
        }
        return Convert.ToHex(this.toBER());
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : ").concat(Convert.ToHex(this.valueBlock.valueBeforeDecodeView));
      }
    }, {
      key: "isEqual",
      value: function isEqual(other) {
        if (this === other) {
          return true;
        }
        if (!(other instanceof this.constructor)) {
          return false;
        }
        var thisRaw = this.toBER();
        var otherRaw = other.toBER();
        return isEqualBuffer(thisRaw, otherRaw);
      }
    }]);
    return BaseBlock;
  }(LocalBaseBlock);
  BaseBlock.NAME = "BaseBlock";
  function prepareIndefiniteForm(baseBlock) {
    if (baseBlock instanceof typeStore.Constructed) {
      var _iterator4 = _createForOfIteratorHelper(baseBlock.valueBlock.value),
        _step4;
      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var value = _step4.value;
          if (prepareIndefiniteForm(value)) {
            baseBlock.lenBlock.isIndefiniteForm = true;
          }
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
    }
    return !!baseBlock.lenBlock.isIndefiniteForm;
  }
  var BaseStringBlock = function (_BaseBlock) {
    _inherits(BaseStringBlock, _BaseBlock);
    function BaseStringBlock() {
      var _this6;
      var _ref5 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref5$value = _ref5.value,
        value = _ref5$value === void 0 ? EMPTY_STRING : _ref5$value,
        parameters = _objectWithoutProperties(_ref5, _excluded2);
      var stringValueBlockType = arguments.length > 1 ? arguments[1] : undefined;
      _classCallCheck(this, BaseStringBlock);
      _this6 = _callSuper(this, BaseStringBlock, [parameters, stringValueBlockType]);
      if (value) {
        _this6.fromString(value);
      }
      return _this6;
    }
    _createClass(BaseStringBlock, [{
      key: "getValue",
      value: function getValue() {
        return this.valueBlock.value;
      }
    }, {
      key: "setValue",
      value: function setValue(value) {
        this.valueBlock.value = value;
      }
    }, {
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, this.lenBlock.isIndefiniteForm ? inputLength : this.lenBlock.length);
        if (resultOffset === -1) {
          this.error = this.valueBlock.error;
          return resultOffset;
        }
        this.fromBuffer(this.valueBlock.valueHexView);
        if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
        if (!this.valueBlock.error.length) this.blockLength += this.valueBlock.blockLength;
        return resultOffset;
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : '").concat(this.valueBlock.value, "'");
      }
    }]);
    return BaseStringBlock;
  }(BaseBlock);
  BaseStringBlock.NAME = "BaseStringBlock";
  var LocalPrimitiveValueBlock = function (_HexBlock2) {
    _inherits(LocalPrimitiveValueBlock, _HexBlock2);
    function LocalPrimitiveValueBlock() {
      var _this7;
      var _ref6 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref6$isHexOnly = _ref6.isHexOnly,
        isHexOnly = _ref6$isHexOnly === void 0 ? true : _ref6$isHexOnly,
        parameters = _objectWithoutProperties(_ref6, _excluded3);
      _classCallCheck(this, LocalPrimitiveValueBlock);
      _this7 = _callSuper(this, LocalPrimitiveValueBlock, [parameters]);
      _this7.isHexOnly = isHexOnly;
      return _this7;
    }
    return _createClass(LocalPrimitiveValueBlock);
  }(HexBlock(ValueBlock));
  LocalPrimitiveValueBlock.NAME = "PrimitiveValueBlock";
  var _a$w;
  var Primitive = function (_BaseBlock2) {
    _inherits(Primitive, _BaseBlock2);
    function Primitive() {
      var _this8;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Primitive);
      _this8 = _callSuper(this, Primitive, [parameters, LocalPrimitiveValueBlock]);
      _this8.idBlock.isConstructed = false;
      return _this8;
    }
    return _createClass(Primitive);
  }(BaseBlock);
  _a$w = Primitive;
  (function () {
    typeStore.Primitive = _a$w;
  })();
  Primitive.NAME = "PRIMITIVE";
  function localChangeType(inputObject, newType) {
    if (inputObject instanceof newType) {
      return inputObject;
    }
    var newObject = new newType();
    newObject.idBlock = inputObject.idBlock;
    newObject.lenBlock = inputObject.lenBlock;
    newObject.warnings = inputObject.warnings;
    newObject.valueBeforeDecodeView = inputObject.valueBeforeDecodeView;
    return newObject;
  }
  function localFromBER(inputBuffer) {
    var inputOffset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var inputLength = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : inputBuffer.length;
    var incomingOffset = inputOffset;
    var returnObject = new BaseBlock({}, ValueBlock);
    var baseBlock = new LocalBaseBlock();
    if (!checkBufferParams(baseBlock, inputBuffer, inputOffset, inputLength)) {
      returnObject.error = baseBlock.error;
      return {
        offset: -1,
        result: returnObject
      };
    }
    var intBuffer = inputBuffer.subarray(inputOffset, inputOffset + inputLength);
    if (!intBuffer.length) {
      returnObject.error = "Zero buffer length";
      return {
        offset: -1,
        result: returnObject
      };
    }
    var resultOffset = returnObject.idBlock.fromBER(inputBuffer, inputOffset, inputLength);
    if (returnObject.idBlock.warnings.length) {
      returnObject.warnings.concat(returnObject.idBlock.warnings);
    }
    if (resultOffset === -1) {
      returnObject.error = returnObject.idBlock.error;
      return {
        offset: -1,
        result: returnObject
      };
    }
    inputOffset = resultOffset;
    inputLength -= returnObject.idBlock.blockLength;
    resultOffset = returnObject.lenBlock.fromBER(inputBuffer, inputOffset, inputLength);
    if (returnObject.lenBlock.warnings.length) {
      returnObject.warnings.concat(returnObject.lenBlock.warnings);
    }
    if (resultOffset === -1) {
      returnObject.error = returnObject.lenBlock.error;
      return {
        offset: -1,
        result: returnObject
      };
    }
    inputOffset = resultOffset;
    inputLength -= returnObject.lenBlock.blockLength;
    if (!returnObject.idBlock.isConstructed && returnObject.lenBlock.isIndefiniteForm) {
      returnObject.error = "Indefinite length form used for primitive encoding form";
      return {
        offset: -1,
        result: returnObject
      };
    }
    var newASN1Type = BaseBlock;
    switch (returnObject.idBlock.tagClass) {
      case 1:
        if (returnObject.idBlock.tagNumber >= 37 && returnObject.idBlock.isHexOnly === false) {
          returnObject.error = "UNIVERSAL 37 and upper tags are reserved by ASN.1 standard";
          return {
            offset: -1,
            result: returnObject
          };
        }
        switch (returnObject.idBlock.tagNumber) {
          case 0:
            if (returnObject.idBlock.isConstructed && returnObject.lenBlock.length > 0) {
              returnObject.error = "Type [UNIVERSAL 0] is reserved";
              return {
                offset: -1,
                result: returnObject
              };
            }
            newASN1Type = typeStore.EndOfContent;
            break;
          case 1:
            newASN1Type = typeStore.Boolean;
            break;
          case 2:
            newASN1Type = typeStore.Integer;
            break;
          case 3:
            newASN1Type = typeStore.BitString;
            break;
          case 4:
            newASN1Type = typeStore.OctetString;
            break;
          case 5:
            newASN1Type = typeStore.Null;
            break;
          case 6:
            newASN1Type = typeStore.ObjectIdentifier;
            break;
          case 10:
            newASN1Type = typeStore.Enumerated;
            break;
          case 12:
            newASN1Type = typeStore.Utf8String;
            break;
          case 13:
            newASN1Type = typeStore.RelativeObjectIdentifier;
            break;
          case 14:
            newASN1Type = typeStore.TIME;
            break;
          case 15:
            returnObject.error = "[UNIVERSAL 15] is reserved by ASN.1 standard";
            return {
              offset: -1,
              result: returnObject
            };
          case 16:
            newASN1Type = typeStore.Sequence;
            break;
          case 17:
            newASN1Type = typeStore.Set;
            break;
          case 18:
            newASN1Type = typeStore.NumericString;
            break;
          case 19:
            newASN1Type = typeStore.PrintableString;
            break;
          case 20:
            newASN1Type = typeStore.TeletexString;
            break;
          case 21:
            newASN1Type = typeStore.VideotexString;
            break;
          case 22:
            newASN1Type = typeStore.IA5String;
            break;
          case 23:
            newASN1Type = typeStore.UTCTime;
            break;
          case 24:
            newASN1Type = typeStore.GeneralizedTime;
            break;
          case 25:
            newASN1Type = typeStore.GraphicString;
            break;
          case 26:
            newASN1Type = typeStore.VisibleString;
            break;
          case 27:
            newASN1Type = typeStore.GeneralString;
            break;
          case 28:
            newASN1Type = typeStore.UniversalString;
            break;
          case 29:
            newASN1Type = typeStore.CharacterString;
            break;
          case 30:
            newASN1Type = typeStore.BmpString;
            break;
          case 31:
            newASN1Type = typeStore.DATE;
            break;
          case 32:
            newASN1Type = typeStore.TimeOfDay;
            break;
          case 33:
            newASN1Type = typeStore.DateTime;
            break;
          case 34:
            newASN1Type = typeStore.Duration;
            break;
          default:
            {
              var newObject = returnObject.idBlock.isConstructed ? new typeStore.Constructed() : new typeStore.Primitive();
              newObject.idBlock = returnObject.idBlock;
              newObject.lenBlock = returnObject.lenBlock;
              newObject.warnings = returnObject.warnings;
              returnObject = newObject;
            }
        }
        break;
      case 2:
      case 3:
      case 4:
      default:
        {
          newASN1Type = returnObject.idBlock.isConstructed ? typeStore.Constructed : typeStore.Primitive;
        }
    }
    returnObject = localChangeType(returnObject, newASN1Type);
    resultOffset = returnObject.fromBER(inputBuffer, inputOffset, returnObject.lenBlock.isIndefiniteForm ? inputLength : returnObject.lenBlock.length);
    returnObject.valueBeforeDecodeView = inputBuffer.subarray(incomingOffset, incomingOffset + returnObject.blockLength);
    return {
      offset: resultOffset,
      result: returnObject
    };
  }
  function fromBER(inputBuffer) {
    if (!inputBuffer.byteLength) {
      var result = new BaseBlock({}, ValueBlock);
      result.error = "Input buffer has zero length";
      return {
        offset: -1,
        result: result
      };
    }
    return localFromBER(BufferSourceConverter.toUint8Array(inputBuffer).slice(), 0, inputBuffer.byteLength);
  }
  function checkLen(indefiniteLength, length) {
    if (indefiniteLength) {
      return 1;
    }
    return length;
  }
  var LocalConstructedValueBlock = function (_ValueBlock) {
    _inherits(LocalConstructedValueBlock, _ValueBlock);
    function LocalConstructedValueBlock() {
      var _this9;
      var _ref7 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref7$value = _ref7.value,
        value = _ref7$value === void 0 ? [] : _ref7$value,
        _ref7$isIndefiniteFor = _ref7.isIndefiniteForm,
        isIndefiniteForm = _ref7$isIndefiniteFor === void 0 ? false : _ref7$isIndefiniteFor,
        parameters = _objectWithoutProperties(_ref7, _excluded4);
      _classCallCheck(this, LocalConstructedValueBlock);
      _this9 = _callSuper(this, LocalConstructedValueBlock, [parameters]);
      _this9.value = value;
      _this9.isIndefiniteForm = isIndefiniteForm;
      return _this9;
    }
    _createClass(LocalConstructedValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var view = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, view, inputOffset, inputLength)) {
          return -1;
        }
        this.valueBeforeDecodeView = view.subarray(inputOffset, inputOffset + inputLength);
        if (this.valueBeforeDecodeView.length === 0) {
          this.warnings.push("Zero buffer length");
          return inputOffset;
        }
        var currentOffset = inputOffset;
        while (checkLen(this.isIndefiniteForm, inputLength) > 0) {
          var returnObject = localFromBER(view, currentOffset, inputLength);
          if (returnObject.offset === -1) {
            this.error = returnObject.result.error;
            this.warnings.concat(returnObject.result.warnings);
            return -1;
          }
          currentOffset = returnObject.offset;
          this.blockLength += returnObject.result.blockLength;
          inputLength -= returnObject.result.blockLength;
          this.value.push(returnObject.result);
          if (this.isIndefiniteForm && returnObject.result.constructor.NAME === END_OF_CONTENT_NAME) {
            break;
          }
        }
        if (this.isIndefiniteForm) {
          if (this.value[this.value.length - 1].constructor.NAME === END_OF_CONTENT_NAME) {
            this.value.pop();
          } else {
            this.warnings.push("No EndOfContent block encoded");
          }
        }
        return currentOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        var _writer = writer || new ViewWriter();
        for (var i = 0; i < this.value.length; i++) {
          this.value[i].toBER(sizeOnly, _writer);
        }
        if (!writer) {
          return _writer.final();
        }
        return EMPTY_BUFFER;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        var object = _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalConstructedValueBlock.prototype), "toJSON", this).call(this)), {}, {
          isIndefiniteForm: this.isIndefiniteForm,
          value: []
        });
        var _iterator5 = _createForOfIteratorHelper(this.value),
          _step5;
        try {
          for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
            var value = _step5.value;
            object.value.push(value.toJSON());
          }
        } catch (err) {
          _iterator5.e(err);
        } finally {
          _iterator5.f();
        }
        return object;
      }
    }]);
    return LocalConstructedValueBlock;
  }(ValueBlock);
  LocalConstructedValueBlock.NAME = "ConstructedValueBlock";
  var _a$v;
  var Constructed = function (_BaseBlock3) {
    _inherits(Constructed, _BaseBlock3);
    function Constructed() {
      var _this10;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Constructed);
      _this10 = _callSuper(this, Constructed, [parameters, LocalConstructedValueBlock]);
      _this10.idBlock.isConstructed = true;
      return _this10;
    }
    _createClass(Constructed, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
        var resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, this.lenBlock.isIndefiniteForm ? inputLength : this.lenBlock.length);
        if (resultOffset === -1) {
          this.error = this.valueBlock.error;
          return resultOffset;
        }
        if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
        if (!this.valueBlock.error.length) this.blockLength += this.valueBlock.blockLength;
        return resultOffset;
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        var values = [];
        var _iterator6 = _createForOfIteratorHelper(this.valueBlock.value),
          _step6;
        try {
          for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
            var value = _step6.value;
            values.push(value.toString("ascii").split("\n").map(function (o) {
              return "  ".concat(o);
            }).join("\n"));
          }
        } catch (err) {
          _iterator6.e(err);
        } finally {
          _iterator6.f();
        }
        var blockName = this.idBlock.tagClass === 3 ? "[".concat(this.idBlock.tagNumber, "]") : this.constructor.NAME;
        return values.length ? "".concat(blockName, " :\n").concat(values.join("\n")) : "".concat(blockName, " :");
      }
    }]);
    return Constructed;
  }(BaseBlock);
  _a$v = Constructed;
  (function () {
    typeStore.Constructed = _a$v;
  })();
  Constructed.NAME = "CONSTRUCTED";
  var LocalEndOfContentValueBlock = function (_ValueBlock2) {
    _inherits(LocalEndOfContentValueBlock, _ValueBlock2);
    function LocalEndOfContentValueBlock() {
      _classCallCheck(this, LocalEndOfContentValueBlock);
      return _callSuper(this, LocalEndOfContentValueBlock, arguments);
    }
    _createClass(LocalEndOfContentValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        return inputOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly) {
        return EMPTY_BUFFER;
      }
    }]);
    return LocalEndOfContentValueBlock;
  }(ValueBlock);
  LocalEndOfContentValueBlock.override = "EndOfContentValueBlock";
  var _a$u;
  var EndOfContent = function (_BaseBlock4) {
    _inherits(EndOfContent, _BaseBlock4);
    function EndOfContent() {
      var _this11;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, EndOfContent);
      _this11 = _callSuper(this, EndOfContent, [parameters, LocalEndOfContentValueBlock]);
      _this11.idBlock.tagClass = 1;
      _this11.idBlock.tagNumber = 0;
      return _this11;
    }
    return _createClass(EndOfContent);
  }(BaseBlock);
  _a$u = EndOfContent;
  (function () {
    typeStore.EndOfContent = _a$u;
  })();
  EndOfContent.NAME = END_OF_CONTENT_NAME;
  var _a$t;
  var Null = function (_BaseBlock5) {
    _inherits(Null, _BaseBlock5);
    function Null() {
      var _this12;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Null);
      _this12 = _callSuper(this, Null, [parameters, ValueBlock]);
      _this12.idBlock.tagClass = 1;
      _this12.idBlock.tagNumber = 5;
      return _this12;
    }
    _createClass(Null, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        if (this.lenBlock.length > 0) this.warnings.push("Non-zero length of value block for Null type");
        if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
        this.blockLength += inputLength;
        if (inputOffset + inputLength > inputBuffer.byteLength) {
          this.error = "End of input reached before message was fully decoded (inconsistent offset and length values)";
          return -1;
        }
        return inputOffset + inputLength;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        var retBuf = new ArrayBuffer(2);
        if (!sizeOnly) {
          var retView = new Uint8Array(retBuf);
          retView[0] = 0x05;
          retView[1] = 0x00;
        }
        if (writer) {
          writer.write(retBuf);
        }
        return retBuf;
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME);
      }
    }]);
    return Null;
  }(BaseBlock);
  _a$t = Null;
  (function () {
    typeStore.Null = _a$t;
  })();
  Null.NAME = "NULL";
  var LocalBooleanValueBlock = function (_HexBlock3) {
    _inherits(LocalBooleanValueBlock, _HexBlock3);
    function LocalBooleanValueBlock() {
      var _this13;
      var _ref8 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        value = _ref8.value,
        parameters = _objectWithoutProperties(_ref8, _excluded5);
      _classCallCheck(this, LocalBooleanValueBlock);
      _this13 = _callSuper(this, LocalBooleanValueBlock, [parameters]);
      if (parameters.valueHex) {
        _this13.valueHexView = BufferSourceConverter.toUint8Array(parameters.valueHex);
      } else {
        _this13.valueHexView = new Uint8Array(1);
      }
      if (value) {
        _this13.value = value;
      }
      return _this13;
    }
    _createClass(LocalBooleanValueBlock, [{
      key: "value",
      get: function get() {
        var _iterator7 = _createForOfIteratorHelper(this.valueHexView),
          _step7;
        try {
          for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
            var octet = _step7.value;
            if (octet > 0) {
              return true;
            }
          }
        } catch (err) {
          _iterator7.e(err);
        } finally {
          _iterator7.f();
        }
        return false;
      },
      set: function set(value) {
        this.valueHexView[0] = value ? 0xFF : 0x00;
      }
    }, {
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
          return -1;
        }
        this.valueHexView = inputView.subarray(inputOffset, inputOffset + inputLength);
        if (inputLength > 1) this.warnings.push("Boolean value encoded in more then 1 octet");
        this.isHexOnly = true;
        utilDecodeTC.call(this);
        this.blockLength = inputLength;
        return inputOffset + inputLength;
      }
    }, {
      key: "toBER",
      value: function toBER() {
        return this.valueHexView.slice();
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalBooleanValueBlock.prototype), "toJSON", this).call(this)), {}, {
          value: this.value
        });
      }
    }]);
    return LocalBooleanValueBlock;
  }(HexBlock(ValueBlock));
  LocalBooleanValueBlock.NAME = "BooleanValueBlock";
  var _a$s;
  var Boolean = function (_BaseBlock6) {
    _inherits(Boolean, _BaseBlock6);
    function Boolean() {
      var _this14;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Boolean);
      _this14 = _callSuper(this, Boolean, [parameters, LocalBooleanValueBlock]);
      _this14.idBlock.tagClass = 1;
      _this14.idBlock.tagNumber = 1;
      return _this14;
    }
    _createClass(Boolean, [{
      key: "getValue",
      value: function getValue() {
        return this.valueBlock.value;
      }
    }, {
      key: "setValue",
      value: function setValue(value) {
        this.valueBlock.value = value;
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : ").concat(this.getValue);
      }
    }]);
    return Boolean;
  }(BaseBlock);
  _a$s = Boolean;
  (function () {
    typeStore.Boolean = _a$s;
  })();
  Boolean.NAME = "BOOLEAN";
  var LocalOctetStringValueBlock = function (_HexBlock4) {
    _inherits(LocalOctetStringValueBlock, _HexBlock4);
    function LocalOctetStringValueBlock() {
      var _this15;
      var _ref9 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref9$isConstructed = _ref9.isConstructed,
        isConstructed = _ref9$isConstructed === void 0 ? false : _ref9$isConstructed,
        parameters = _objectWithoutProperties(_ref9, _excluded6);
      _classCallCheck(this, LocalOctetStringValueBlock);
      _this15 = _callSuper(this, LocalOctetStringValueBlock, [parameters]);
      _this15.isConstructed = isConstructed;
      return _this15;
    }
    _createClass(LocalOctetStringValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var resultOffset = 0;
        if (this.isConstructed) {
          this.isHexOnly = false;
          resultOffset = LocalConstructedValueBlock.prototype.fromBER.call(this, inputBuffer, inputOffset, inputLength);
          if (resultOffset === -1) return resultOffset;
          for (var i = 0; i < this.value.length; i++) {
            var currentBlockName = this.value[i].constructor.NAME;
            if (currentBlockName === END_OF_CONTENT_NAME) {
              if (this.isIndefiniteForm) break;else {
                this.error = "EndOfContent is unexpected, OCTET STRING may consists of OCTET STRINGs only";
                return -1;
              }
            }
            if (currentBlockName !== OCTET_STRING_NAME) {
              this.error = "OCTET STRING may consists of OCTET STRINGs only";
              return -1;
            }
          }
        } else {
          this.isHexOnly = true;
          resultOffset = _get(_getPrototypeOf(LocalOctetStringValueBlock.prototype), "fromBER", this).call(this, inputBuffer, inputOffset, inputLength);
          this.blockLength = inputLength;
        }
        return resultOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        if (this.isConstructed) return LocalConstructedValueBlock.prototype.toBER.call(this, sizeOnly, writer);
        return sizeOnly ? new ArrayBuffer(this.valueHexView.byteLength) : this.valueHexView.slice().buffer;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalOctetStringValueBlock.prototype), "toJSON", this).call(this)), {}, {
          isConstructed: this.isConstructed
        });
      }
    }]);
    return LocalOctetStringValueBlock;
  }(HexBlock(LocalConstructedValueBlock));
  LocalOctetStringValueBlock.NAME = "OctetStringValueBlock";
  var _a$r;
  var OctetString$1 = function (_BaseBlock7) {
    _inherits(OctetString, _BaseBlock7);
    function OctetString() {
      var _this16;
      var _ref10 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref10$idBlock = _ref10.idBlock,
        idBlock = _ref10$idBlock === void 0 ? {} : _ref10$idBlock,
        _ref10$lenBlock = _ref10.lenBlock,
        lenBlock = _ref10$lenBlock === void 0 ? {} : _ref10$lenBlock,
        parameters = _objectWithoutProperties(_ref10, _excluded7);
      _classCallCheck(this, OctetString);
      var _b, _c;
      (_b = parameters.isConstructed) !== null && _b !== void 0 ? _b : parameters.isConstructed = !!((_c = parameters.value) === null || _c === void 0 ? void 0 : _c.length);
      _this16 = _callSuper(this, OctetString, [_objectSpread({
        idBlock: _objectSpread({
          isConstructed: parameters.isConstructed
        }, idBlock),
        lenBlock: _objectSpread(_objectSpread({}, lenBlock), {}, {
          isIndefiniteForm: !!parameters.isIndefiniteForm
        })
      }, parameters), LocalOctetStringValueBlock]);
      _this16.idBlock.tagClass = 1;
      _this16.idBlock.tagNumber = 4;
      return _this16;
    }
    _createClass(OctetString, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        this.valueBlock.isConstructed = this.idBlock.isConstructed;
        this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
        if (inputLength === 0) {
          if (this.idBlock.error.length === 0) this.blockLength += this.idBlock.blockLength;
          if (this.lenBlock.error.length === 0) this.blockLength += this.lenBlock.blockLength;
          return inputOffset;
        }
        if (!this.valueBlock.isConstructed) {
          var view = inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer;
          var buf = view.subarray(inputOffset, inputOffset + inputLength);
          try {
            if (buf.byteLength) {
              var asn = localFromBER(buf, 0, buf.byteLength);
              if (asn.offset !== -1 && asn.offset === inputLength) {
                this.valueBlock.value = [asn.result];
              }
            }
          } catch (e) {}
        }
        return _get(_getPrototypeOf(OctetString.prototype), "fromBER", this).call(this, inputBuffer, inputOffset, inputLength);
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        if (this.valueBlock.isConstructed || this.valueBlock.value && this.valueBlock.value.length) {
          return Constructed.prototype.onAsciiEncoding.call(this);
        }
        return "".concat(this.constructor.NAME, " : ").concat(Convert.ToHex(this.valueBlock.valueHexView));
      }
    }, {
      key: "getValue",
      value: function getValue() {
        if (!this.idBlock.isConstructed) {
          return this.valueBlock.valueHexView.slice().buffer;
        }
        var array = [];
        var _iterator8 = _createForOfIteratorHelper(this.valueBlock.value),
          _step8;
        try {
          for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
            var content = _step8.value;
            if (content instanceof OctetString) {
              array.push(content.valueBlock.valueHexView);
            }
          }
        } catch (err) {
          _iterator8.e(err);
        } finally {
          _iterator8.f();
        }
        return BufferSourceConverter.concat(array);
      }
    }]);
    return OctetString;
  }(BaseBlock);
  _a$r = OctetString$1;
  (function () {
    typeStore.OctetString = _a$r;
  })();
  OctetString$1.NAME = OCTET_STRING_NAME;
  var LocalBitStringValueBlock = function (_HexBlock5) {
    _inherits(LocalBitStringValueBlock, _HexBlock5);
    function LocalBitStringValueBlock() {
      var _this17;
      var _ref11 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref11$unusedBits = _ref11.unusedBits,
        unusedBits = _ref11$unusedBits === void 0 ? 0 : _ref11$unusedBits,
        _ref11$isConstructed = _ref11.isConstructed,
        isConstructed = _ref11$isConstructed === void 0 ? false : _ref11$isConstructed,
        parameters = _objectWithoutProperties(_ref11, _excluded8);
      _classCallCheck(this, LocalBitStringValueBlock);
      _this17 = _callSuper(this, LocalBitStringValueBlock, [parameters]);
      _this17.unusedBits = unusedBits;
      _this17.isConstructed = isConstructed;
      _this17.blockLength = _this17.valueHexView.byteLength;
      return _this17;
    }
    _createClass(LocalBitStringValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        if (!inputLength) {
          return inputOffset;
        }
        var resultOffset = -1;
        if (this.isConstructed) {
          resultOffset = LocalConstructedValueBlock.prototype.fromBER.call(this, inputBuffer, inputOffset, inputLength);
          if (resultOffset === -1) return resultOffset;
          var _iterator9 = _createForOfIteratorHelper(this.value),
            _step9;
          try {
            for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
              var value = _step9.value;
              var currentBlockName = value.constructor.NAME;
              if (currentBlockName === END_OF_CONTENT_NAME) {
                if (this.isIndefiniteForm) break;else {
                  this.error = "EndOfContent is unexpected, BIT STRING may consists of BIT STRINGs only";
                  return -1;
                }
              }
              if (currentBlockName !== BIT_STRING_NAME) {
                this.error = "BIT STRING may consists of BIT STRINGs only";
                return -1;
              }
              var valueBlock = value.valueBlock;
              if (this.unusedBits > 0 && valueBlock.unusedBits > 0) {
                this.error = "Using of \"unused bits\" inside constructive BIT STRING allowed for least one only";
                return -1;
              }
              this.unusedBits = valueBlock.unusedBits;
            }
          } catch (err) {
            _iterator9.e(err);
          } finally {
            _iterator9.f();
          }
          return resultOffset;
        }
        var inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
          return -1;
        }
        var intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        this.unusedBits = intBuffer[0];
        if (this.unusedBits > 7) {
          this.error = "Unused bits for BitString must be in range 0-7";
          return -1;
        }
        if (!this.unusedBits) {
          var buf = intBuffer.subarray(1);
          try {
            if (buf.byteLength) {
              var asn = localFromBER(buf, 0, buf.byteLength);
              if (asn.offset !== -1 && asn.offset === inputLength - 1) {
                this.value = [asn.result];
              }
            }
          } catch (e) {}
        }
        this.valueHexView = intBuffer.subarray(1);
        this.blockLength = intBuffer.length;
        return inputOffset + inputLength;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        if (this.isConstructed) {
          return LocalConstructedValueBlock.prototype.toBER.call(this, sizeOnly, writer);
        }
        if (sizeOnly) {
          return new ArrayBuffer(this.valueHexView.byteLength + 1);
        }
        if (!this.valueHexView.byteLength) {
          return EMPTY_BUFFER;
        }
        var retView = new Uint8Array(this.valueHexView.length + 1);
        retView[0] = this.unusedBits;
        retView.set(this.valueHexView, 1);
        return retView.buffer;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalBitStringValueBlock.prototype), "toJSON", this).call(this)), {}, {
          unusedBits: this.unusedBits,
          isConstructed: this.isConstructed
        });
      }
    }]);
    return LocalBitStringValueBlock;
  }(HexBlock(LocalConstructedValueBlock));
  LocalBitStringValueBlock.NAME = "BitStringValueBlock";
  var _a$q;
  var BitString$1 = function (_BaseBlock8) {
    _inherits(BitString, _BaseBlock8);
    function BitString() {
      var _this18;
      var _ref12 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref12$idBlock = _ref12.idBlock,
        idBlock = _ref12$idBlock === void 0 ? {} : _ref12$idBlock,
        _ref12$lenBlock = _ref12.lenBlock,
        lenBlock = _ref12$lenBlock === void 0 ? {} : _ref12$lenBlock,
        parameters = _objectWithoutProperties(_ref12, _excluded9);
      _classCallCheck(this, BitString);
      var _b, _c;
      (_b = parameters.isConstructed) !== null && _b !== void 0 ? _b : parameters.isConstructed = !!((_c = parameters.value) === null || _c === void 0 ? void 0 : _c.length);
      _this18 = _callSuper(this, BitString, [_objectSpread({
        idBlock: _objectSpread({
          isConstructed: parameters.isConstructed
        }, idBlock),
        lenBlock: _objectSpread(_objectSpread({}, lenBlock), {}, {
          isIndefiniteForm: !!parameters.isIndefiniteForm
        })
      }, parameters), LocalBitStringValueBlock]);
      _this18.idBlock.tagClass = 1;
      _this18.idBlock.tagNumber = 3;
      return _this18;
    }
    _createClass(BitString, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        this.valueBlock.isConstructed = this.idBlock.isConstructed;
        this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
        return _get(_getPrototypeOf(BitString.prototype), "fromBER", this).call(this, inputBuffer, inputOffset, inputLength);
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        if (this.valueBlock.isConstructed || this.valueBlock.value && this.valueBlock.value.length) {
          return Constructed.prototype.onAsciiEncoding.call(this);
        } else {
          var bits = [];
          var valueHex = this.valueBlock.valueHexView;
          var _iterator10 = _createForOfIteratorHelper(valueHex),
            _step10;
          try {
            for (_iterator10.s(); !(_step10 = _iterator10.n()).done;) {
              var byte = _step10.value;
              bits.push(byte.toString(2).padStart(8, "0"));
            }
          } catch (err) {
            _iterator10.e(err);
          } finally {
            _iterator10.f();
          }
          var bitsStr = bits.join("");
          return "".concat(this.constructor.NAME, " : ").concat(bitsStr.substring(0, bitsStr.length - this.valueBlock.unusedBits));
        }
      }
    }]);
    return BitString;
  }(BaseBlock);
  _a$q = BitString$1;
  (function () {
    typeStore.BitString = _a$q;
  })();
  BitString$1.NAME = BIT_STRING_NAME;
  var _a$p;
  function viewAdd(first, second) {
    var c = new Uint8Array([0]);
    var firstView = new Uint8Array(first);
    var secondView = new Uint8Array(second);
    var firstViewCopy = firstView.slice(0);
    var firstViewCopyLength = firstViewCopy.length - 1;
    var secondViewCopy = secondView.slice(0);
    var secondViewCopyLength = secondViewCopy.length - 1;
    var value = 0;
    var max = secondViewCopyLength < firstViewCopyLength ? firstViewCopyLength : secondViewCopyLength;
    var counter = 0;
    for (var i = max; i >= 0; i--, counter++) {
      switch (true) {
        case counter < secondViewCopy.length:
          value = firstViewCopy[firstViewCopyLength - counter] + secondViewCopy[secondViewCopyLength - counter] + c[0];
          break;
        default:
          value = firstViewCopy[firstViewCopyLength - counter] + c[0];
      }
      c[0] = value / 10;
      switch (true) {
        case counter >= firstViewCopy.length:
          firstViewCopy = utilConcatView(new Uint8Array([value % 10]), firstViewCopy);
          break;
        default:
          firstViewCopy[firstViewCopyLength - counter] = value % 10;
      }
    }
    if (c[0] > 0) firstViewCopy = utilConcatView(c, firstViewCopy);
    return firstViewCopy;
  }
  function power2(n) {
    if (n >= powers2.length) {
      for (var p = powers2.length; p <= n; p++) {
        var c = new Uint8Array([0]);
        var digits = powers2[p - 1].slice(0);
        for (var i = digits.length - 1; i >= 0; i--) {
          var newValue = new Uint8Array([(digits[i] << 1) + c[0]]);
          c[0] = newValue[0] / 10;
          digits[i] = newValue[0] % 10;
        }
        if (c[0] > 0) digits = utilConcatView(c, digits);
        powers2.push(digits);
      }
    }
    return powers2[n];
  }
  function viewSub(first, second) {
    var b = 0;
    var firstView = new Uint8Array(first);
    var secondView = new Uint8Array(second);
    var firstViewCopy = firstView.slice(0);
    var firstViewCopyLength = firstViewCopy.length - 1;
    var secondViewCopy = secondView.slice(0);
    var secondViewCopyLength = secondViewCopy.length - 1;
    var value;
    var counter = 0;
    for (var i = secondViewCopyLength; i >= 0; i--, counter++) {
      value = firstViewCopy[firstViewCopyLength - counter] - secondViewCopy[secondViewCopyLength - counter] - b;
      switch (true) {
        case value < 0:
          b = 1;
          firstViewCopy[firstViewCopyLength - counter] = value + 10;
          break;
        default:
          b = 0;
          firstViewCopy[firstViewCopyLength - counter] = value;
      }
    }
    if (b > 0) {
      for (var _i6 = firstViewCopyLength - secondViewCopyLength + 1; _i6 >= 0; _i6--, counter++) {
        value = firstViewCopy[firstViewCopyLength - counter] - b;
        if (value < 0) {
          b = 1;
          firstViewCopy[firstViewCopyLength - counter] = value + 10;
        } else {
          b = 0;
          firstViewCopy[firstViewCopyLength - counter] = value;
          break;
        }
      }
    }
    return firstViewCopy.slice();
  }
  var LocalIntegerValueBlock = function (_HexBlock6) {
    _inherits(LocalIntegerValueBlock, _HexBlock6);
    function LocalIntegerValueBlock() {
      var _this19;
      var _ref13 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        value = _ref13.value,
        parameters = _objectWithoutProperties(_ref13, _excluded10);
      _classCallCheck(this, LocalIntegerValueBlock);
      _this19 = _callSuper(this, LocalIntegerValueBlock, [parameters]);
      _this19._valueDec = 0;
      if (parameters.valueHex) {
        _this19.setValueHex();
      }
      if (value !== undefined) {
        _this19.valueDec = value;
      }
      return _this19;
    }
    _createClass(LocalIntegerValueBlock, [{
      key: "setValueHex",
      value: function setValueHex() {
        if (this.valueHexView.length >= 4) {
          this.warnings.push("Too big Integer for decoding, hex only");
          this.isHexOnly = true;
          this._valueDec = 0;
        } else {
          this.isHexOnly = false;
          if (this.valueHexView.length > 0) {
            this._valueDec = utilDecodeTC.call(this);
          }
        }
      }
    }, {
      key: "valueDec",
      get: function get() {
        return this._valueDec;
      },
      set: function set(v) {
        this._valueDec = v;
        this.isHexOnly = false;
        this.valueHexView = new Uint8Array(utilEncodeTC(v));
      }
    }, {
      key: "fromDER",
      value: function fromDER(inputBuffer, inputOffset, inputLength) {
        var expectedLength = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
        var offset = this.fromBER(inputBuffer, inputOffset, inputLength);
        if (offset === -1) return offset;
        var view = this.valueHexView;
        if (view[0] === 0x00 && (view[1] & 0x80) !== 0) {
          this.valueHexView = view.subarray(1);
        } else {
          if (expectedLength !== 0) {
            if (view.length < expectedLength) {
              if (expectedLength - view.length > 1) expectedLength = view.length + 1;
              this.valueHexView = view.subarray(expectedLength - view.length);
            }
          }
        }
        return offset;
      }
    }, {
      key: "toDER",
      value: function toDER() {
        var sizeOnly = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
        var view = this.valueHexView;
        switch (true) {
          case (view[0] & 0x80) !== 0:
            {
              var updatedView = new Uint8Array(this.valueHexView.length + 1);
              updatedView[0] = 0x00;
              updatedView.set(view, 1);
              this.valueHexView = updatedView;
            }
            break;
          case view[0] === 0x00 && (view[1] & 0x80) === 0:
            {
              this.valueHexView = this.valueHexView.subarray(1);
            }
            break;
        }
        return this.toBER(sizeOnly);
      }
    }, {
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var resultOffset = _get(_getPrototypeOf(LocalIntegerValueBlock.prototype), "fromBER", this).call(this, inputBuffer, inputOffset, inputLength);
        if (resultOffset === -1) {
          return resultOffset;
        }
        this.setValueHex();
        return resultOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly) {
        return sizeOnly ? new ArrayBuffer(this.valueHexView.length) : this.valueHexView.slice().buffer;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalIntegerValueBlock.prototype), "toJSON", this).call(this)), {}, {
          valueDec: this.valueDec
        });
      }
    }, {
      key: "toString",
      value: function toString() {
        var firstBit = this.valueHexView.length * 8 - 1;
        var digits = new Uint8Array(this.valueHexView.length * 8 / 3);
        var bitNumber = 0;
        var currentByte;
        var asn1View = this.valueHexView;
        var result = "";
        var flag = false;
        for (var byteNumber = asn1View.byteLength - 1; byteNumber >= 0; byteNumber--) {
          currentByte = asn1View[byteNumber];
          for (var i = 0; i < 8; i++) {
            if ((currentByte & 1) === 1) {
              switch (bitNumber) {
                case firstBit:
                  digits = viewSub(power2(bitNumber), digits);
                  result = "-";
                  break;
                default:
                  digits = viewAdd(digits, power2(bitNumber));
              }
            }
            bitNumber++;
            currentByte >>= 1;
          }
        }
        for (var _i7 = 0; _i7 < digits.length; _i7++) {
          if (digits[_i7]) flag = true;
          if (flag) result += digitsString.charAt(digits[_i7]);
        }
        if (flag === false) result += digitsString.charAt(0);
        return result;
      }
    }]);
    return LocalIntegerValueBlock;
  }(HexBlock(ValueBlock));
  _a$p = LocalIntegerValueBlock;
  LocalIntegerValueBlock.NAME = "IntegerValueBlock";
  (function () {
    Object.defineProperty(_a$p.prototype, "valueHex", {
      set: function set(v) {
        this.valueHexView = new Uint8Array(v);
        this.setValueHex();
      },
      get: function get() {
        return this.valueHexView.slice().buffer;
      }
    });
  })();
  var _a$o;
  var Integer = function (_BaseBlock9) {
    _inherits(Integer, _BaseBlock9);
    function Integer() {
      var _this20;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Integer);
      _this20 = _callSuper(this, Integer, [parameters, LocalIntegerValueBlock]);
      _this20.idBlock.tagClass = 1;
      _this20.idBlock.tagNumber = 2;
      return _this20;
    }
    _createClass(Integer, [{
      key: "toBigInt",
      value: function toBigInt() {
        assertBigInt();
        return BigInt(this.valueBlock.toString());
      }
    }, {
      key: "convertToDER",
      value: function convertToDER() {
        var integer = new Integer({
          valueHex: this.valueBlock.valueHexView
        });
        integer.valueBlock.toDER();
        return integer;
      }
    }, {
      key: "convertFromDER",
      value: function convertFromDER() {
        return new Integer({
          valueHex: this.valueBlock.valueHexView[0] === 0 ? this.valueBlock.valueHexView.subarray(1) : this.valueBlock.valueHexView
        });
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : ").concat(this.valueBlock.toString());
      }
    }], [{
      key: "fromBigInt",
      value: function fromBigInt(value) {
        assertBigInt();
        var bigIntValue = BigInt(value);
        var writer = new ViewWriter();
        var hex = bigIntValue.toString(16).replace(/^-/, "");
        var view = new Uint8Array(Convert.FromHex(hex));
        if (bigIntValue < 0) {
          var first = new Uint8Array(view.length + (view[0] & 0x80 ? 1 : 0));
          first[0] |= 0x80;
          var firstInt = BigInt("0x".concat(Convert.ToHex(first)));
          var secondInt = firstInt + bigIntValue;
          var second = BufferSourceConverter.toUint8Array(Convert.FromHex(secondInt.toString(16)));
          second[0] |= 0x80;
          writer.write(second);
        } else {
          if (view[0] & 0x80) {
            writer.write(new Uint8Array([0]));
          }
          writer.write(view);
        }
        var res = new Integer({
          valueHex: writer.final()
        });
        return res;
      }
    }]);
    return Integer;
  }(BaseBlock);
  _a$o = Integer;
  (function () {
    typeStore.Integer = _a$o;
  })();
  Integer.NAME = "INTEGER";
  var _a$n;
  var Enumerated = function (_Integer) {
    _inherits(Enumerated, _Integer);
    function Enumerated() {
      var _this21;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Enumerated);
      _this21 = _callSuper(this, Enumerated, [parameters]);
      _this21.idBlock.tagClass = 1;
      _this21.idBlock.tagNumber = 10;
      return _this21;
    }
    return _createClass(Enumerated);
  }(Integer);
  _a$n = Enumerated;
  (function () {
    typeStore.Enumerated = _a$n;
  })();
  Enumerated.NAME = "ENUMERATED";
  var LocalSidValueBlock = function (_HexBlock7) {
    _inherits(LocalSidValueBlock, _HexBlock7);
    function LocalSidValueBlock() {
      var _this22;
      var _ref14 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref14$valueDec = _ref14.valueDec,
        valueDec = _ref14$valueDec === void 0 ? -1 : _ref14$valueDec,
        _ref14$isFirstSid = _ref14.isFirstSid,
        isFirstSid = _ref14$isFirstSid === void 0 ? false : _ref14$isFirstSid,
        parameters = _objectWithoutProperties(_ref14, _excluded11);
      _classCallCheck(this, LocalSidValueBlock);
      _this22 = _callSuper(this, LocalSidValueBlock, [parameters]);
      _this22.valueDec = valueDec;
      _this22.isFirstSid = isFirstSid;
      return _this22;
    }
    _createClass(LocalSidValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        if (!inputLength) {
          return inputOffset;
        }
        var inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
          return -1;
        }
        var intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        this.valueHexView = new Uint8Array(inputLength);
        for (var i = 0; i < inputLength; i++) {
          this.valueHexView[i] = intBuffer[i] & 0x7F;
          this.blockLength++;
          if ((intBuffer[i] & 0x80) === 0x00) break;
        }
        var tempView = new Uint8Array(this.blockLength);
        for (var _i8 = 0; _i8 < this.blockLength; _i8++) {
          tempView[_i8] = this.valueHexView[_i8];
        }
        this.valueHexView = tempView;
        if ((intBuffer[this.blockLength - 1] & 0x80) !== 0x00) {
          this.error = "End of input reached before message was fully decoded";
          return -1;
        }
        if (this.valueHexView[0] === 0x00) this.warnings.push("Needlessly long format of SID encoding");
        if (this.blockLength <= 8) this.valueDec = utilFromBase(this.valueHexView, 7);else {
          this.isHexOnly = true;
          this.warnings.push("Too big SID for decoding, hex only");
        }
        return inputOffset + this.blockLength;
      }
    }, {
      key: "valueBigInt",
      set: function set(value) {
        assertBigInt();
        var bits = BigInt(value).toString(2);
        while (bits.length % 7) {
          bits = "0" + bits;
        }
        var bytes = new Uint8Array(bits.length / 7);
        for (var i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(bits.slice(i * 7, i * 7 + 7), 2) + (i + 1 < bytes.length ? 0x80 : 0);
        }
        this.fromBER(bytes.buffer, 0, bytes.length);
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly) {
        if (this.isHexOnly) {
          if (sizeOnly) return new ArrayBuffer(this.valueHexView.byteLength);
          var curView = this.valueHexView;
          var _retView4 = new Uint8Array(this.blockLength);
          for (var i = 0; i < this.blockLength - 1; i++) _retView4[i] = curView[i] | 0x80;
          _retView4[this.blockLength - 1] = curView[this.blockLength - 1];
          return _retView4.buffer;
        }
        var encodedBuf = utilToBase(this.valueDec, 7);
        if (encodedBuf.byteLength === 0) {
          this.error = "Error during encoding SID value";
          return EMPTY_BUFFER;
        }
        var retView = new Uint8Array(encodedBuf.byteLength);
        if (!sizeOnly) {
          var encodedView = new Uint8Array(encodedBuf);
          var len = encodedBuf.byteLength - 1;
          for (var _i9 = 0; _i9 < len; _i9++) retView[_i9] = encodedView[_i9] | 0x80;
          retView[len] = encodedView[len];
        }
        return retView;
      }
    }, {
      key: "toString",
      value: function toString() {
        var result = "";
        if (this.isHexOnly) result = Convert.ToHex(this.valueHexView);else {
          if (this.isFirstSid) {
            var sidValue = this.valueDec;
            if (this.valueDec <= 39) result = "0.";else {
              if (this.valueDec <= 79) {
                result = "1.";
                sidValue -= 40;
              } else {
                result = "2.";
                sidValue -= 80;
              }
            }
            result += sidValue.toString();
          } else result = this.valueDec.toString();
        }
        return result;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalSidValueBlock.prototype), "toJSON", this).call(this)), {}, {
          valueDec: this.valueDec,
          isFirstSid: this.isFirstSid
        });
      }
    }]);
    return LocalSidValueBlock;
  }(HexBlock(ValueBlock));
  LocalSidValueBlock.NAME = "sidBlock";
  var LocalObjectIdentifierValueBlock = function (_ValueBlock3) {
    _inherits(LocalObjectIdentifierValueBlock, _ValueBlock3);
    function LocalObjectIdentifierValueBlock() {
      var _this23;
      var _ref15 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref15$value = _ref15.value,
        value = _ref15$value === void 0 ? EMPTY_STRING : _ref15$value,
        parameters = _objectWithoutProperties(_ref15, _excluded12);
      _classCallCheck(this, LocalObjectIdentifierValueBlock);
      _this23 = _callSuper(this, LocalObjectIdentifierValueBlock, [parameters]);
      _this23.value = [];
      if (value) {
        _this23.fromString(value);
      }
      return _this23;
    }
    _createClass(LocalObjectIdentifierValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var resultOffset = inputOffset;
        while (inputLength > 0) {
          var sidBlock = new LocalSidValueBlock();
          resultOffset = sidBlock.fromBER(inputBuffer, resultOffset, inputLength);
          if (resultOffset === -1) {
            this.blockLength = 0;
            this.error = sidBlock.error;
            return resultOffset;
          }
          if (this.value.length === 0) sidBlock.isFirstSid = true;
          this.blockLength += sidBlock.blockLength;
          inputLength -= sidBlock.blockLength;
          this.value.push(sidBlock);
        }
        return resultOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly) {
        var retBuffers = [];
        for (var i = 0; i < this.value.length; i++) {
          var valueBuf = this.value[i].toBER(sizeOnly);
          if (valueBuf.byteLength === 0) {
            this.error = this.value[i].error;
            return EMPTY_BUFFER;
          }
          retBuffers.push(valueBuf);
        }
        return concat$1(retBuffers);
      }
    }, {
      key: "fromString",
      value: function fromString(string) {
        this.value = [];
        var pos1 = 0;
        var pos2 = 0;
        var sid = "";
        var flag = false;
        do {
          pos2 = string.indexOf(".", pos1);
          if (pos2 === -1) sid = string.substring(pos1);else sid = string.substring(pos1, pos2);
          pos1 = pos2 + 1;
          if (flag) {
            var sidBlock = this.value[0];
            var plus = 0;
            switch (sidBlock.valueDec) {
              case 0:
                break;
              case 1:
                plus = 40;
                break;
              case 2:
                plus = 80;
                break;
              default:
                this.value = [];
                return;
            }
            var parsedSID = parseInt(sid, 10);
            if (isNaN(parsedSID)) return;
            sidBlock.valueDec = parsedSID + plus;
            flag = false;
          } else {
            var _sidBlock = new LocalSidValueBlock();
            if (sid > Number.MAX_SAFE_INTEGER) {
              assertBigInt();
              var sidValue = BigInt(sid);
              _sidBlock.valueBigInt = sidValue;
            } else {
              _sidBlock.valueDec = parseInt(sid, 10);
              if (isNaN(_sidBlock.valueDec)) return;
            }
            if (!this.value.length) {
              _sidBlock.isFirstSid = true;
              flag = true;
            }
            this.value.push(_sidBlock);
          }
        } while (pos2 !== -1);
      }
    }, {
      key: "toString",
      value: function toString() {
        var result = "";
        var isHexOnly = false;
        for (var i = 0; i < this.value.length; i++) {
          isHexOnly = this.value[i].isHexOnly;
          var sidStr = this.value[i].toString();
          if (i !== 0) result = "".concat(result, ".");
          if (isHexOnly) {
            sidStr = "{".concat(sidStr, "}");
            if (this.value[i].isFirstSid) result = "2.{".concat(sidStr, " - 80}");else result += sidStr;
          } else result += sidStr;
        }
        return result;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        var object = _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalObjectIdentifierValueBlock.prototype), "toJSON", this).call(this)), {}, {
          value: this.toString(),
          sidArray: []
        });
        for (var i = 0; i < this.value.length; i++) {
          object.sidArray.push(this.value[i].toJSON());
        }
        return object;
      }
    }]);
    return LocalObjectIdentifierValueBlock;
  }(ValueBlock);
  LocalObjectIdentifierValueBlock.NAME = "ObjectIdentifierValueBlock";
  var _a$m;
  var ObjectIdentifier$1 = function (_BaseBlock10) {
    _inherits(ObjectIdentifier, _BaseBlock10);
    function ObjectIdentifier() {
      var _this24;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, ObjectIdentifier);
      _this24 = _callSuper(this, ObjectIdentifier, [parameters, LocalObjectIdentifierValueBlock]);
      _this24.idBlock.tagClass = 1;
      _this24.idBlock.tagNumber = 6;
      return _this24;
    }
    _createClass(ObjectIdentifier, [{
      key: "getValue",
      value: function getValue() {
        return this.valueBlock.toString();
      }
    }, {
      key: "setValue",
      value: function setValue(value) {
        this.valueBlock.fromString(value);
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : ").concat(this.valueBlock.toString() || "empty");
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(ObjectIdentifier.prototype), "toJSON", this).call(this)), {}, {
          value: this.getValue()
        });
      }
    }]);
    return ObjectIdentifier;
  }(BaseBlock);
  _a$m = ObjectIdentifier$1;
  (function () {
    typeStore.ObjectIdentifier = _a$m;
  })();
  ObjectIdentifier$1.NAME = "OBJECT IDENTIFIER";
  var LocalRelativeSidValueBlock = function (_HexBlock8) {
    _inherits(LocalRelativeSidValueBlock, _HexBlock8);
    function LocalRelativeSidValueBlock() {
      var _this25;
      var _ref16 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref16$valueDec = _ref16.valueDec,
        valueDec = _ref16$valueDec === void 0 ? 0 : _ref16$valueDec,
        parameters = _objectWithoutProperties(_ref16, _excluded13);
      _classCallCheck(this, LocalRelativeSidValueBlock);
      _this25 = _callSuper(this, LocalRelativeSidValueBlock, [parameters]);
      _this25.valueDec = valueDec;
      return _this25;
    }
    _createClass(LocalRelativeSidValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        if (inputLength === 0) return inputOffset;
        var inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) return -1;
        var intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        this.valueHexView = new Uint8Array(inputLength);
        for (var i = 0; i < inputLength; i++) {
          this.valueHexView[i] = intBuffer[i] & 0x7F;
          this.blockLength++;
          if ((intBuffer[i] & 0x80) === 0x00) break;
        }
        var tempView = new Uint8Array(this.blockLength);
        for (var _i10 = 0; _i10 < this.blockLength; _i10++) tempView[_i10] = this.valueHexView[_i10];
        this.valueHexView = tempView;
        if ((intBuffer[this.blockLength - 1] & 0x80) !== 0x00) {
          this.error = "End of input reached before message was fully decoded";
          return -1;
        }
        if (this.valueHexView[0] === 0x00) this.warnings.push("Needlessly long format of SID encoding");
        if (this.blockLength <= 8) this.valueDec = utilFromBase(this.valueHexView, 7);else {
          this.isHexOnly = true;
          this.warnings.push("Too big SID for decoding, hex only");
        }
        return inputOffset + this.blockLength;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly) {
        if (this.isHexOnly) {
          if (sizeOnly) return new ArrayBuffer(this.valueHexView.byteLength);
          var curView = this.valueHexView;
          var _retView5 = new Uint8Array(this.blockLength);
          for (var i = 0; i < this.blockLength - 1; i++) _retView5[i] = curView[i] | 0x80;
          _retView5[this.blockLength - 1] = curView[this.blockLength - 1];
          return _retView5.buffer;
        }
        var encodedBuf = utilToBase(this.valueDec, 7);
        if (encodedBuf.byteLength === 0) {
          this.error = "Error during encoding SID value";
          return EMPTY_BUFFER;
        }
        var retView = new Uint8Array(encodedBuf.byteLength);
        if (!sizeOnly) {
          var encodedView = new Uint8Array(encodedBuf);
          var len = encodedBuf.byteLength - 1;
          for (var _i11 = 0; _i11 < len; _i11++) retView[_i11] = encodedView[_i11] | 0x80;
          retView[len] = encodedView[len];
        }
        return retView.buffer;
      }
    }, {
      key: "toString",
      value: function toString() {
        var result = "";
        if (this.isHexOnly) result = Convert.ToHex(this.valueHexView);else {
          result = this.valueDec.toString();
        }
        return result;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalRelativeSidValueBlock.prototype), "toJSON", this).call(this)), {}, {
          valueDec: this.valueDec
        });
      }
    }]);
    return LocalRelativeSidValueBlock;
  }(HexBlock(LocalBaseBlock));
  LocalRelativeSidValueBlock.NAME = "relativeSidBlock";
  var LocalRelativeObjectIdentifierValueBlock = function (_ValueBlock4) {
    _inherits(LocalRelativeObjectIdentifierValueBlock, _ValueBlock4);
    function LocalRelativeObjectIdentifierValueBlock() {
      var _this26;
      var _ref17 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref17$value = _ref17.value,
        value = _ref17$value === void 0 ? EMPTY_STRING : _ref17$value,
        parameters = _objectWithoutProperties(_ref17, _excluded14);
      _classCallCheck(this, LocalRelativeObjectIdentifierValueBlock);
      _this26 = _callSuper(this, LocalRelativeObjectIdentifierValueBlock, [parameters]);
      _this26.value = [];
      if (value) {
        _this26.fromString(value);
      }
      return _this26;
    }
    _createClass(LocalRelativeObjectIdentifierValueBlock, [{
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var resultOffset = inputOffset;
        while (inputLength > 0) {
          var sidBlock = new LocalRelativeSidValueBlock();
          resultOffset = sidBlock.fromBER(inputBuffer, resultOffset, inputLength);
          if (resultOffset === -1) {
            this.blockLength = 0;
            this.error = sidBlock.error;
            return resultOffset;
          }
          this.blockLength += sidBlock.blockLength;
          inputLength -= sidBlock.blockLength;
          this.value.push(sidBlock);
        }
        return resultOffset;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly, writer) {
        var retBuffers = [];
        for (var i = 0; i < this.value.length; i++) {
          var valueBuf = this.value[i].toBER(sizeOnly);
          if (valueBuf.byteLength === 0) {
            this.error = this.value[i].error;
            return EMPTY_BUFFER;
          }
          retBuffers.push(valueBuf);
        }
        return concat$1(retBuffers);
      }
    }, {
      key: "fromString",
      value: function fromString(string) {
        this.value = [];
        var pos1 = 0;
        var pos2 = 0;
        var sid = "";
        do {
          pos2 = string.indexOf(".", pos1);
          if (pos2 === -1) sid = string.substring(pos1);else sid = string.substring(pos1, pos2);
          pos1 = pos2 + 1;
          var sidBlock = new LocalRelativeSidValueBlock();
          sidBlock.valueDec = parseInt(sid, 10);
          if (isNaN(sidBlock.valueDec)) return true;
          this.value.push(sidBlock);
        } while (pos2 !== -1);
        return true;
      }
    }, {
      key: "toString",
      value: function toString() {
        var result = "";
        var isHexOnly = false;
        for (var i = 0; i < this.value.length; i++) {
          isHexOnly = this.value[i].isHexOnly;
          var sidStr = this.value[i].toString();
          if (i !== 0) result = "".concat(result, ".");
          if (isHexOnly) {
            sidStr = "{".concat(sidStr, "}");
            result += sidStr;
          } else result += sidStr;
        }
        return result;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        var object = _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalRelativeObjectIdentifierValueBlock.prototype), "toJSON", this).call(this)), {}, {
          value: this.toString(),
          sidArray: []
        });
        for (var i = 0; i < this.value.length; i++) object.sidArray.push(this.value[i].toJSON());
        return object;
      }
    }]);
    return LocalRelativeObjectIdentifierValueBlock;
  }(ValueBlock);
  LocalRelativeObjectIdentifierValueBlock.NAME = "RelativeObjectIdentifierValueBlock";
  var _a$l;
  var RelativeObjectIdentifier = function (_BaseBlock11) {
    _inherits(RelativeObjectIdentifier, _BaseBlock11);
    function RelativeObjectIdentifier() {
      var _this27;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, RelativeObjectIdentifier);
      _this27 = _callSuper(this, RelativeObjectIdentifier, [parameters, LocalRelativeObjectIdentifierValueBlock]);
      _this27.idBlock.tagClass = 1;
      _this27.idBlock.tagNumber = 13;
      return _this27;
    }
    _createClass(RelativeObjectIdentifier, [{
      key: "getValue",
      value: function getValue() {
        return this.valueBlock.toString();
      }
    }, {
      key: "setValue",
      value: function setValue(value) {
        this.valueBlock.fromString(value);
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : ").concat(this.valueBlock.toString() || "empty");
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(RelativeObjectIdentifier.prototype), "toJSON", this).call(this)), {}, {
          value: this.getValue()
        });
      }
    }]);
    return RelativeObjectIdentifier;
  }(BaseBlock);
  _a$l = RelativeObjectIdentifier;
  (function () {
    typeStore.RelativeObjectIdentifier = _a$l;
  })();
  RelativeObjectIdentifier.NAME = "RelativeObjectIdentifier";
  var _a$k;
  var Sequence = function (_Constructed) {
    _inherits(Sequence, _Constructed);
    function Sequence() {
      var _this28;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Sequence);
      _this28 = _callSuper(this, Sequence, [parameters]);
      _this28.idBlock.tagClass = 1;
      _this28.idBlock.tagNumber = 16;
      return _this28;
    }
    return _createClass(Sequence);
  }(Constructed);
  _a$k = Sequence;
  (function () {
    typeStore.Sequence = _a$k;
  })();
  Sequence.NAME = "SEQUENCE";
  var _a$j;
  var Set = function (_Constructed2) {
    _inherits(Set, _Constructed2);
    function Set() {
      var _this29;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Set);
      _this29 = _callSuper(this, Set, [parameters]);
      _this29.idBlock.tagClass = 1;
      _this29.idBlock.tagNumber = 17;
      return _this29;
    }
    return _createClass(Set);
  }(Constructed);
  _a$j = Set;
  (function () {
    typeStore.Set = _a$j;
  })();
  Set.NAME = "SET";
  var LocalStringValueBlock = function (_HexBlock9) {
    _inherits(LocalStringValueBlock, _HexBlock9);
    function LocalStringValueBlock() {
      var _this30;
      var _ref18 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        parameters = Object.assign({}, (_objectDestructuringEmpty(_ref18), _ref18));
      _classCallCheck(this, LocalStringValueBlock);
      _this30 = _callSuper(this, LocalStringValueBlock, [parameters]);
      _this30.isHexOnly = true;
      _this30.value = EMPTY_STRING;
      return _this30;
    }
    _createClass(LocalStringValueBlock, [{
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(LocalStringValueBlock.prototype), "toJSON", this).call(this)), {}, {
          value: this.value
        });
      }
    }]);
    return LocalStringValueBlock;
  }(HexBlock(ValueBlock));
  LocalStringValueBlock.NAME = "StringValueBlock";
  var LocalSimpleStringValueBlock = function (_LocalStringValueBloc) {
    _inherits(LocalSimpleStringValueBlock, _LocalStringValueBloc);
    function LocalSimpleStringValueBlock() {
      _classCallCheck(this, LocalSimpleStringValueBlock);
      return _callSuper(this, LocalSimpleStringValueBlock, arguments);
    }
    return _createClass(LocalSimpleStringValueBlock);
  }(LocalStringValueBlock);
  LocalSimpleStringValueBlock.NAME = "SimpleStringValueBlock";
  var LocalSimpleStringBlock = function (_BaseStringBlock) {
    _inherits(LocalSimpleStringBlock, _BaseStringBlock);
    function LocalSimpleStringBlock() {
      var _ref19 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        parameters = Object.assign({}, (_objectDestructuringEmpty(_ref19), _ref19));
      _classCallCheck(this, LocalSimpleStringBlock);
      return _callSuper(this, LocalSimpleStringBlock, [parameters, LocalSimpleStringValueBlock]);
    }
    _createClass(LocalSimpleStringBlock, [{
      key: "fromBuffer",
      value: function fromBuffer(inputBuffer) {
        this.valueBlock.value = String.fromCharCode.apply(null, BufferSourceConverter.toUint8Array(inputBuffer));
      }
    }, {
      key: "fromString",
      value: function fromString(inputString) {
        var strLen = inputString.length;
        var view = this.valueBlock.valueHexView = new Uint8Array(strLen);
        for (var i = 0; i < strLen; i++) view[i] = inputString.charCodeAt(i);
        this.valueBlock.value = inputString;
      }
    }]);
    return LocalSimpleStringBlock;
  }(BaseStringBlock);
  LocalSimpleStringBlock.NAME = "SIMPLE STRING";
  var LocalUtf8StringValueBlock = function (_LocalSimpleStringBlo) {
    _inherits(LocalUtf8StringValueBlock, _LocalSimpleStringBlo);
    function LocalUtf8StringValueBlock() {
      _classCallCheck(this, LocalUtf8StringValueBlock);
      return _callSuper(this, LocalUtf8StringValueBlock, arguments);
    }
    _createClass(LocalUtf8StringValueBlock, [{
      key: "fromBuffer",
      value: function fromBuffer(inputBuffer) {
        this.valueBlock.valueHexView = BufferSourceConverter.toUint8Array(inputBuffer);
        try {
          this.valueBlock.value = Convert.ToUtf8String(inputBuffer);
        } catch (ex) {
          this.warnings.push("Error during \"decodeURIComponent\": ".concat(ex, ", using raw string"));
          this.valueBlock.value = Convert.ToBinary(inputBuffer);
        }
      }
    }, {
      key: "fromString",
      value: function fromString(inputString) {
        this.valueBlock.valueHexView = new Uint8Array(Convert.FromUtf8String(inputString));
        this.valueBlock.value = inputString;
      }
    }]);
    return LocalUtf8StringValueBlock;
  }(LocalSimpleStringBlock);
  LocalUtf8StringValueBlock.NAME = "Utf8StringValueBlock";
  var _a$i;
  var Utf8String = function (_LocalUtf8StringValue) {
    _inherits(Utf8String, _LocalUtf8StringValue);
    function Utf8String() {
      var _this31;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Utf8String);
      _this31 = _callSuper(this, Utf8String, [parameters]);
      _this31.idBlock.tagClass = 1;
      _this31.idBlock.tagNumber = 12;
      return _this31;
    }
    return _createClass(Utf8String);
  }(LocalUtf8StringValueBlock);
  _a$i = Utf8String;
  (function () {
    typeStore.Utf8String = _a$i;
  })();
  Utf8String.NAME = "UTF8String";
  var LocalBmpStringValueBlock = function (_LocalSimpleStringBlo2) {
    _inherits(LocalBmpStringValueBlock, _LocalSimpleStringBlo2);
    function LocalBmpStringValueBlock() {
      _classCallCheck(this, LocalBmpStringValueBlock);
      return _callSuper(this, LocalBmpStringValueBlock, arguments);
    }
    _createClass(LocalBmpStringValueBlock, [{
      key: "fromBuffer",
      value: function fromBuffer(inputBuffer) {
        this.valueBlock.value = Convert.ToUtf16String(inputBuffer);
        this.valueBlock.valueHexView = BufferSourceConverter.toUint8Array(inputBuffer);
      }
    }, {
      key: "fromString",
      value: function fromString(inputString) {
        this.valueBlock.value = inputString;
        this.valueBlock.valueHexView = new Uint8Array(Convert.FromUtf16String(inputString));
      }
    }]);
    return LocalBmpStringValueBlock;
  }(LocalSimpleStringBlock);
  LocalBmpStringValueBlock.NAME = "BmpStringValueBlock";
  var _a$h;
  var BmpString = function (_LocalBmpStringValueB) {
    _inherits(BmpString, _LocalBmpStringValueB);
    function BmpString() {
      var _this32;
      var _ref20 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        parameters = Object.assign({}, (_objectDestructuringEmpty(_ref20), _ref20));
      _classCallCheck(this, BmpString);
      _this32 = _callSuper(this, BmpString, [parameters]);
      _this32.idBlock.tagClass = 1;
      _this32.idBlock.tagNumber = 30;
      return _this32;
    }
    return _createClass(BmpString);
  }(LocalBmpStringValueBlock);
  _a$h = BmpString;
  (function () {
    typeStore.BmpString = _a$h;
  })();
  BmpString.NAME = "BMPString";
  var LocalUniversalStringValueBlock = function (_LocalSimpleStringBlo3) {
    _inherits(LocalUniversalStringValueBlock, _LocalSimpleStringBlo3);
    function LocalUniversalStringValueBlock() {
      _classCallCheck(this, LocalUniversalStringValueBlock);
      return _callSuper(this, LocalUniversalStringValueBlock, arguments);
    }
    _createClass(LocalUniversalStringValueBlock, [{
      key: "fromBuffer",
      value: function fromBuffer(inputBuffer) {
        var copyBuffer = ArrayBuffer.isView(inputBuffer) ? inputBuffer.slice().buffer : inputBuffer.slice(0);
        var valueView = new Uint8Array(copyBuffer);
        for (var i = 0; i < valueView.length; i += 4) {
          valueView[i] = valueView[i + 3];
          valueView[i + 1] = valueView[i + 2];
          valueView[i + 2] = 0x00;
          valueView[i + 3] = 0x00;
        }
        this.valueBlock.value = String.fromCharCode.apply(null, new Uint32Array(copyBuffer));
      }
    }, {
      key: "fromString",
      value: function fromString(inputString) {
        var strLength = inputString.length;
        var valueHexView = this.valueBlock.valueHexView = new Uint8Array(strLength * 4);
        for (var i = 0; i < strLength; i++) {
          var codeBuf = utilToBase(inputString.charCodeAt(i), 8);
          var codeView = new Uint8Array(codeBuf);
          if (codeView.length > 4) continue;
          var dif = 4 - codeView.length;
          for (var j = codeView.length - 1; j >= 0; j--) valueHexView[i * 4 + j + dif] = codeView[j];
        }
        this.valueBlock.value = inputString;
      }
    }]);
    return LocalUniversalStringValueBlock;
  }(LocalSimpleStringBlock);
  LocalUniversalStringValueBlock.NAME = "UniversalStringValueBlock";
  var _a$g;
  var UniversalString = function (_LocalUniversalString) {
    _inherits(UniversalString, _LocalUniversalString);
    function UniversalString() {
      var _this33;
      var _ref21 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        parameters = Object.assign({}, (_objectDestructuringEmpty(_ref21), _ref21));
      _classCallCheck(this, UniversalString);
      _this33 = _callSuper(this, UniversalString, [parameters]);
      _this33.idBlock.tagClass = 1;
      _this33.idBlock.tagNumber = 28;
      return _this33;
    }
    return _createClass(UniversalString);
  }(LocalUniversalStringValueBlock);
  _a$g = UniversalString;
  (function () {
    typeStore.UniversalString = _a$g;
  })();
  UniversalString.NAME = "UniversalString";
  var _a$f;
  var NumericString = function (_LocalSimpleStringBlo4) {
    _inherits(NumericString, _LocalSimpleStringBlo4);
    function NumericString() {
      var _this34;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, NumericString);
      _this34 = _callSuper(this, NumericString, [parameters]);
      _this34.idBlock.tagClass = 1;
      _this34.idBlock.tagNumber = 18;
      return _this34;
    }
    return _createClass(NumericString);
  }(LocalSimpleStringBlock);
  _a$f = NumericString;
  (function () {
    typeStore.NumericString = _a$f;
  })();
  NumericString.NAME = "NumericString";
  var _a$e;
  var PrintableString = function (_LocalSimpleStringBlo5) {
    _inherits(PrintableString, _LocalSimpleStringBlo5);
    function PrintableString() {
      var _this35;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, PrintableString);
      _this35 = _callSuper(this, PrintableString, [parameters]);
      _this35.idBlock.tagClass = 1;
      _this35.idBlock.tagNumber = 19;
      return _this35;
    }
    return _createClass(PrintableString);
  }(LocalSimpleStringBlock);
  _a$e = PrintableString;
  (function () {
    typeStore.PrintableString = _a$e;
  })();
  PrintableString.NAME = "PrintableString";
  var _a$d;
  var TeletexString = function (_LocalSimpleStringBlo6) {
    _inherits(TeletexString, _LocalSimpleStringBlo6);
    function TeletexString() {
      var _this36;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, TeletexString);
      _this36 = _callSuper(this, TeletexString, [parameters]);
      _this36.idBlock.tagClass = 1;
      _this36.idBlock.tagNumber = 20;
      return _this36;
    }
    return _createClass(TeletexString);
  }(LocalSimpleStringBlock);
  _a$d = TeletexString;
  (function () {
    typeStore.TeletexString = _a$d;
  })();
  TeletexString.NAME = "TeletexString";
  var _a$c;
  var VideotexString = function (_LocalSimpleStringBlo7) {
    _inherits(VideotexString, _LocalSimpleStringBlo7);
    function VideotexString() {
      var _this37;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, VideotexString);
      _this37 = _callSuper(this, VideotexString, [parameters]);
      _this37.idBlock.tagClass = 1;
      _this37.idBlock.tagNumber = 21;
      return _this37;
    }
    return _createClass(VideotexString);
  }(LocalSimpleStringBlock);
  _a$c = VideotexString;
  (function () {
    typeStore.VideotexString = _a$c;
  })();
  VideotexString.NAME = "VideotexString";
  var _a$b;
  var IA5String = function (_LocalSimpleStringBlo8) {
    _inherits(IA5String, _LocalSimpleStringBlo8);
    function IA5String() {
      var _this38;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, IA5String);
      _this38 = _callSuper(this, IA5String, [parameters]);
      _this38.idBlock.tagClass = 1;
      _this38.idBlock.tagNumber = 22;
      return _this38;
    }
    return _createClass(IA5String);
  }(LocalSimpleStringBlock);
  _a$b = IA5String;
  (function () {
    typeStore.IA5String = _a$b;
  })();
  IA5String.NAME = "IA5String";
  var _a$a;
  var GraphicString = function (_LocalSimpleStringBlo9) {
    _inherits(GraphicString, _LocalSimpleStringBlo9);
    function GraphicString() {
      var _this39;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, GraphicString);
      _this39 = _callSuper(this, GraphicString, [parameters]);
      _this39.idBlock.tagClass = 1;
      _this39.idBlock.tagNumber = 25;
      return _this39;
    }
    return _createClass(GraphicString);
  }(LocalSimpleStringBlock);
  _a$a = GraphicString;
  (function () {
    typeStore.GraphicString = _a$a;
  })();
  GraphicString.NAME = "GraphicString";
  var _a$9;
  var VisibleString = function (_LocalSimpleStringBlo10) {
    _inherits(VisibleString, _LocalSimpleStringBlo10);
    function VisibleString() {
      var _this40;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, VisibleString);
      _this40 = _callSuper(this, VisibleString, [parameters]);
      _this40.idBlock.tagClass = 1;
      _this40.idBlock.tagNumber = 26;
      return _this40;
    }
    return _createClass(VisibleString);
  }(LocalSimpleStringBlock);
  _a$9 = VisibleString;
  (function () {
    typeStore.VisibleString = _a$9;
  })();
  VisibleString.NAME = "VisibleString";
  var _a$8;
  var GeneralString = function (_LocalSimpleStringBlo11) {
    _inherits(GeneralString, _LocalSimpleStringBlo11);
    function GeneralString() {
      var _this41;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, GeneralString);
      _this41 = _callSuper(this, GeneralString, [parameters]);
      _this41.idBlock.tagClass = 1;
      _this41.idBlock.tagNumber = 27;
      return _this41;
    }
    return _createClass(GeneralString);
  }(LocalSimpleStringBlock);
  _a$8 = GeneralString;
  (function () {
    typeStore.GeneralString = _a$8;
  })();
  GeneralString.NAME = "GeneralString";
  var _a$7;
  var CharacterString = function (_LocalSimpleStringBlo12) {
    _inherits(CharacterString, _LocalSimpleStringBlo12);
    function CharacterString() {
      var _this42;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, CharacterString);
      _this42 = _callSuper(this, CharacterString, [parameters]);
      _this42.idBlock.tagClass = 1;
      _this42.idBlock.tagNumber = 29;
      return _this42;
    }
    return _createClass(CharacterString);
  }(LocalSimpleStringBlock);
  _a$7 = CharacterString;
  (function () {
    typeStore.CharacterString = _a$7;
  })();
  CharacterString.NAME = "CharacterString";
  var _a$6;
  var UTCTime = function (_VisibleString) {
    _inherits(UTCTime, _VisibleString);
    function UTCTime() {
      var _this43;
      var _ref22 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        value = _ref22.value,
        valueDate = _ref22.valueDate,
        parameters = _objectWithoutProperties(_ref22, _excluded15);
      _classCallCheck(this, UTCTime);
      _this43 = _callSuper(this, UTCTime, [parameters]);
      _this43.year = 0;
      _this43.month = 0;
      _this43.day = 0;
      _this43.hour = 0;
      _this43.minute = 0;
      _this43.second = 0;
      if (value) {
        _this43.fromString(value);
        _this43.valueBlock.valueHexView = new Uint8Array(value.length);
        for (var i = 0; i < value.length; i++) _this43.valueBlock.valueHexView[i] = value.charCodeAt(i);
      }
      if (valueDate) {
        _this43.fromDate(valueDate);
        _this43.valueBlock.valueHexView = new Uint8Array(_this43.toBuffer());
      }
      _this43.idBlock.tagClass = 1;
      _this43.idBlock.tagNumber = 23;
      return _this43;
    }
    _createClass(UTCTime, [{
      key: "fromBuffer",
      value: function fromBuffer(inputBuffer) {
        this.fromString(String.fromCharCode.apply(null, BufferSourceConverter.toUint8Array(inputBuffer)));
      }
    }, {
      key: "toBuffer",
      value: function toBuffer() {
        var str = this.toString();
        var buffer = new ArrayBuffer(str.length);
        var view = new Uint8Array(buffer);
        for (var i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
        return buffer;
      }
    }, {
      key: "fromDate",
      value: function fromDate(inputDate) {
        this.year = inputDate.getUTCFullYear();
        this.month = inputDate.getUTCMonth() + 1;
        this.day = inputDate.getUTCDate();
        this.hour = inputDate.getUTCHours();
        this.minute = inputDate.getUTCMinutes();
        this.second = inputDate.getUTCSeconds();
      }
    }, {
      key: "toDate",
      value: function toDate() {
        return new Date(Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second));
      }
    }, {
      key: "fromString",
      value: function fromString(inputString) {
        var parser = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z/ig;
        var parserArray = parser.exec(inputString);
        if (parserArray === null) {
          this.error = "Wrong input string for conversion";
          return;
        }
        var year = parseInt(parserArray[1], 10);
        if (year >= 50) this.year = 1900 + year;else this.year = 2000 + year;
        this.month = parseInt(parserArray[2], 10);
        this.day = parseInt(parserArray[3], 10);
        this.hour = parseInt(parserArray[4], 10);
        this.minute = parseInt(parserArray[5], 10);
        this.second = parseInt(parserArray[6], 10);
      }
    }, {
      key: "toString",
      value: function toString() {
        var encoding = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "iso";
        if (encoding === "iso") {
          var outputArray = new Array(7);
          outputArray[0] = padNumber(this.year < 2000 ? this.year - 1900 : this.year - 2000, 2);
          outputArray[1] = padNumber(this.month, 2);
          outputArray[2] = padNumber(this.day, 2);
          outputArray[3] = padNumber(this.hour, 2);
          outputArray[4] = padNumber(this.minute, 2);
          outputArray[5] = padNumber(this.second, 2);
          outputArray[6] = "Z";
          return outputArray.join("");
        }
        return _get(_getPrototypeOf(UTCTime.prototype), "toString", this).call(this, encoding);
      }
    }, {
      key: "onAsciiEncoding",
      value: function onAsciiEncoding() {
        return "".concat(this.constructor.NAME, " : ").concat(this.toDate().toISOString());
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(UTCTime.prototype), "toJSON", this).call(this)), {}, {
          year: this.year,
          month: this.month,
          day: this.day,
          hour: this.hour,
          minute: this.minute,
          second: this.second
        });
      }
    }]);
    return UTCTime;
  }(VisibleString);
  _a$6 = UTCTime;
  (function () {
    typeStore.UTCTime = _a$6;
  })();
  UTCTime.NAME = "UTCTime";
  var _a$5;
  var GeneralizedTime = function (_UTCTime) {
    _inherits(GeneralizedTime, _UTCTime);
    function GeneralizedTime() {
      var _this44;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, GeneralizedTime);
      var _b;
      _this44 = _callSuper(this, GeneralizedTime, [parameters]);
      (_b = _this44.millisecond) !== null && _b !== void 0 ? _b : _this44.millisecond = 0;
      _this44.idBlock.tagClass = 1;
      _this44.idBlock.tagNumber = 24;
      return _this44;
    }
    _createClass(GeneralizedTime, [{
      key: "fromDate",
      value: function fromDate(inputDate) {
        _get(_getPrototypeOf(GeneralizedTime.prototype), "fromDate", this).call(this, inputDate);
        this.millisecond = inputDate.getUTCMilliseconds();
      }
    }, {
      key: "toDate",
      value: function toDate() {
        return new Date(Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second, this.millisecond));
      }
    }, {
      key: "fromString",
      value: function fromString(inputString) {
        var isUTC = false;
        var timeString = "";
        var dateTimeString = "";
        var fractionPart = 0;
        var parser;
        var hourDifference = 0;
        var minuteDifference = 0;
        if (inputString[inputString.length - 1] === "Z") {
          timeString = inputString.substring(0, inputString.length - 1);
          isUTC = true;
        } else {
          var number = new Number(inputString[inputString.length - 1]);
          if (isNaN(number.valueOf())) throw new Error("Wrong input string for conversion");
          timeString = inputString;
        }
        if (isUTC) {
          if (timeString.indexOf("+") !== -1) throw new Error("Wrong input string for conversion");
          if (timeString.indexOf("-") !== -1) throw new Error("Wrong input string for conversion");
        } else {
          var multiplier = 1;
          var differencePosition = timeString.indexOf("+");
          var differenceString = "";
          if (differencePosition === -1) {
            differencePosition = timeString.indexOf("-");
            multiplier = -1;
          }
          if (differencePosition !== -1) {
            differenceString = timeString.substring(differencePosition + 1);
            timeString = timeString.substring(0, differencePosition);
            if (differenceString.length !== 2 && differenceString.length !== 4) throw new Error("Wrong input string for conversion");
            var _number = parseInt(differenceString.substring(0, 2), 10);
            if (isNaN(_number.valueOf())) throw new Error("Wrong input string for conversion");
            hourDifference = multiplier * _number;
            if (differenceString.length === 4) {
              _number = parseInt(differenceString.substring(2, 4), 10);
              if (isNaN(_number.valueOf())) throw new Error("Wrong input string for conversion");
              minuteDifference = multiplier * _number;
            }
          }
        }
        var fractionPointPosition = timeString.indexOf(".");
        if (fractionPointPosition === -1) fractionPointPosition = timeString.indexOf(",");
        if (fractionPointPosition !== -1) {
          var fractionPartCheck = new Number("0".concat(timeString.substring(fractionPointPosition)));
          if (isNaN(fractionPartCheck.valueOf())) throw new Error("Wrong input string for conversion");
          fractionPart = fractionPartCheck.valueOf();
          dateTimeString = timeString.substring(0, fractionPointPosition);
        } else dateTimeString = timeString;
        switch (true) {
          case dateTimeString.length === 8:
            parser = /(\d{4})(\d{2})(\d{2})/ig;
            if (fractionPointPosition !== -1) throw new Error("Wrong input string for conversion");
            break;
          case dateTimeString.length === 10:
            parser = /(\d{4})(\d{2})(\d{2})(\d{2})/ig;
            if (fractionPointPosition !== -1) {
              var fractionResult = 60 * fractionPart;
              this.minute = Math.floor(fractionResult);
              fractionResult = 60 * (fractionResult - this.minute);
              this.second = Math.floor(fractionResult);
              fractionResult = 1000 * (fractionResult - this.second);
              this.millisecond = Math.floor(fractionResult);
            }
            break;
          case dateTimeString.length === 12:
            parser = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/ig;
            if (fractionPointPosition !== -1) {
              var _fractionResult = 60 * fractionPart;
              this.second = Math.floor(_fractionResult);
              _fractionResult = 1000 * (_fractionResult - this.second);
              this.millisecond = Math.floor(_fractionResult);
            }
            break;
          case dateTimeString.length === 14:
            parser = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/ig;
            if (fractionPointPosition !== -1) {
              var _fractionResult2 = 1000 * fractionPart;
              this.millisecond = Math.floor(_fractionResult2);
            }
            break;
          default:
            throw new Error("Wrong input string for conversion");
        }
        var parserArray = parser.exec(dateTimeString);
        if (parserArray === null) throw new Error("Wrong input string for conversion");
        for (var j = 1; j < parserArray.length; j++) {
          switch (j) {
            case 1:
              this.year = parseInt(parserArray[j], 10);
              break;
            case 2:
              this.month = parseInt(parserArray[j], 10);
              break;
            case 3:
              this.day = parseInt(parserArray[j], 10);
              break;
            case 4:
              this.hour = parseInt(parserArray[j], 10) + hourDifference;
              break;
            case 5:
              this.minute = parseInt(parserArray[j], 10) + minuteDifference;
              break;
            case 6:
              this.second = parseInt(parserArray[j], 10);
              break;
            default:
              throw new Error("Wrong input string for conversion");
          }
        }
        if (isUTC === false) {
          var tempDate = new Date(this.year, this.month, this.day, this.hour, this.minute, this.second, this.millisecond);
          this.year = tempDate.getUTCFullYear();
          this.month = tempDate.getUTCMonth();
          this.day = tempDate.getUTCDay();
          this.hour = tempDate.getUTCHours();
          this.minute = tempDate.getUTCMinutes();
          this.second = tempDate.getUTCSeconds();
          this.millisecond = tempDate.getUTCMilliseconds();
        }
      }
    }, {
      key: "toString",
      value: function toString() {
        var encoding = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "iso";
        if (encoding === "iso") {
          var outputArray = [];
          outputArray.push(padNumber(this.year, 4));
          outputArray.push(padNumber(this.month, 2));
          outputArray.push(padNumber(this.day, 2));
          outputArray.push(padNumber(this.hour, 2));
          outputArray.push(padNumber(this.minute, 2));
          outputArray.push(padNumber(this.second, 2));
          if (this.millisecond !== 0) {
            outputArray.push(".");
            outputArray.push(padNumber(this.millisecond, 3));
          }
          outputArray.push("Z");
          return outputArray.join("");
        }
        return _get(_getPrototypeOf(GeneralizedTime.prototype), "toString", this).call(this, encoding);
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return _objectSpread(_objectSpread({}, _get(_getPrototypeOf(GeneralizedTime.prototype), "toJSON", this).call(this)), {}, {
          millisecond: this.millisecond
        });
      }
    }]);
    return GeneralizedTime;
  }(UTCTime);
  _a$5 = GeneralizedTime;
  (function () {
    typeStore.GeneralizedTime = _a$5;
  })();
  GeneralizedTime.NAME = "GeneralizedTime";
  var _a$4;
  var DATE = function (_Utf8String) {
    _inherits(DATE, _Utf8String);
    function DATE() {
      var _this45;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, DATE);
      _this45 = _callSuper(this, DATE, [parameters]);
      _this45.idBlock.tagClass = 1;
      _this45.idBlock.tagNumber = 31;
      return _this45;
    }
    return _createClass(DATE);
  }(Utf8String);
  _a$4 = DATE;
  (function () {
    typeStore.DATE = _a$4;
  })();
  DATE.NAME = "DATE";
  var _a$3;
  var TimeOfDay = function (_Utf8String2) {
    _inherits(TimeOfDay, _Utf8String2);
    function TimeOfDay() {
      var _this46;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, TimeOfDay);
      _this46 = _callSuper(this, TimeOfDay, [parameters]);
      _this46.idBlock.tagClass = 1;
      _this46.idBlock.tagNumber = 32;
      return _this46;
    }
    return _createClass(TimeOfDay);
  }(Utf8String);
  _a$3 = TimeOfDay;
  (function () {
    typeStore.TimeOfDay = _a$3;
  })();
  TimeOfDay.NAME = "TimeOfDay";
  var _a$2;
  var DateTime = function (_Utf8String3) {
    _inherits(DateTime, _Utf8String3);
    function DateTime() {
      var _this47;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, DateTime);
      _this47 = _callSuper(this, DateTime, [parameters]);
      _this47.idBlock.tagClass = 1;
      _this47.idBlock.tagNumber = 33;
      return _this47;
    }
    return _createClass(DateTime);
  }(Utf8String);
  _a$2 = DateTime;
  (function () {
    typeStore.DateTime = _a$2;
  })();
  DateTime.NAME = "DateTime";
  var _a$1;
  var Duration = function (_Utf8String4) {
    _inherits(Duration, _Utf8String4);
    function Duration() {
      var _this48;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, Duration);
      _this48 = _callSuper(this, Duration, [parameters]);
      _this48.idBlock.tagClass = 1;
      _this48.idBlock.tagNumber = 34;
      return _this48;
    }
    return _createClass(Duration);
  }(Utf8String);
  _a$1 = Duration;
  (function () {
    typeStore.Duration = _a$1;
  })();
  Duration.NAME = "Duration";
  var _a;
  var TIME = function (_Utf8String5) {
    _inherits(TIME, _Utf8String5);
    function TIME() {
      var _this49;
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, TIME);
      _this49 = _callSuper(this, TIME, [parameters]);
      _this49.idBlock.tagClass = 1;
      _this49.idBlock.tagNumber = 14;
      return _this49;
    }
    return _createClass(TIME);
  }(Utf8String);
  _a = TIME;
  (function () {
    typeStore.TIME = _a;
  })();
  TIME.NAME = "TIME";
  var Any = _createClass(function Any() {
    var _ref23 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref23$name = _ref23.name,
      name = _ref23$name === void 0 ? EMPTY_STRING : _ref23$name,
      _ref23$optional = _ref23.optional,
      optional = _ref23$optional === void 0 ? false : _ref23$optional;
    _classCallCheck(this, Any);
    this.name = name;
    this.optional = optional;
  });
  var Choice = function (_Any) {
    _inherits(Choice, _Any);
    function Choice() {
      var _this50;
      var _ref24 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref24$value = _ref24.value,
        value = _ref24$value === void 0 ? [] : _ref24$value,
        parameters = _objectWithoutProperties(_ref24, _excluded16);
      _classCallCheck(this, Choice);
      _this50 = _callSuper(this, Choice, [parameters]);
      _this50.value = value;
      return _this50;
    }
    return _createClass(Choice);
  }(Any);
  var Repeated = function (_Any2) {
    _inherits(Repeated, _Any2);
    function Repeated() {
      var _this51;
      var _ref25 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref25$value = _ref25.value,
        value = _ref25$value === void 0 ? new Any() : _ref25$value,
        _ref25$local = _ref25.local,
        local = _ref25$local === void 0 ? false : _ref25$local,
        parameters = _objectWithoutProperties(_ref25, _excluded17);
      _classCallCheck(this, Repeated);
      _this51 = _callSuper(this, Repeated, [parameters]);
      _this51.value = value;
      _this51.local = local;
      return _this51;
    }
    return _createClass(Repeated);
  }(Any);
  var RawData = function () {
    function RawData() {
      var _ref26 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref26$data = _ref26.data,
        data = _ref26$data === void 0 ? EMPTY_VIEW : _ref26$data;
      _classCallCheck(this, RawData);
      this.dataView = BufferSourceConverter.toUint8Array(data);
    }
    _createClass(RawData, [{
      key: "data",
      get: function get() {
        return this.dataView.slice().buffer;
      },
      set: function set(value) {
        this.dataView = BufferSourceConverter.toUint8Array(value);
      }
    }, {
      key: "fromBER",
      value: function fromBER(inputBuffer, inputOffset, inputLength) {
        var endLength = inputOffset + inputLength;
        this.dataView = BufferSourceConverter.toUint8Array(inputBuffer).subarray(inputOffset, endLength);
        return endLength;
      }
    }, {
      key: "toBER",
      value: function toBER(sizeOnly) {
        return this.dataView.slice().buffer;
      }
    }]);
    return RawData;
  }();
  function compareSchema(root, inputData, inputSchema) {
    if (inputSchema instanceof Choice) {
      for (var j = 0; j < inputSchema.value.length; j++) {
        var result = compareSchema(root, inputData, inputSchema.value[j]);
        if (result.verified) {
          return {
            verified: true,
            result: root
          };
        }
      }
      {
        var _result = {
          verified: false,
          result: {
            error: "Wrong values for Choice type"
          }
        };
        if (inputSchema.hasOwnProperty(NAME)) _result.name = inputSchema.name;
        return _result;
      }
    }
    if (inputSchema instanceof Any) {
      if (inputSchema.hasOwnProperty(NAME)) root[inputSchema.name] = inputData;
      return {
        verified: true,
        result: root
      };
    }
    if (root instanceof Object === false) {
      return {
        verified: false,
        result: {
          error: "Wrong root object"
        }
      };
    }
    if (inputData instanceof Object === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 data"
        }
      };
    }
    if (inputSchema instanceof Object === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (ID_BLOCK in inputSchema === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (FROM_BER in inputSchema.idBlock === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (TO_BER in inputSchema.idBlock === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    var encodedId = inputSchema.idBlock.toBER(false);
    if (encodedId.byteLength === 0) {
      return {
        verified: false,
        result: {
          error: "Error encoding idBlock for ASN.1 schema"
        }
      };
    }
    var decodedOffset = inputSchema.idBlock.fromBER(encodedId, 0, encodedId.byteLength);
    if (decodedOffset === -1) {
      return {
        verified: false,
        result: {
          error: "Error decoding idBlock for ASN.1 schema"
        }
      };
    }
    if (inputSchema.idBlock.hasOwnProperty(TAG_CLASS) === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (inputSchema.idBlock.tagClass !== inputData.idBlock.tagClass) {
      return {
        verified: false,
        result: root
      };
    }
    if (inputSchema.idBlock.hasOwnProperty(TAG_NUMBER) === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (inputSchema.idBlock.tagNumber !== inputData.idBlock.tagNumber) {
      return {
        verified: false,
        result: root
      };
    }
    if (inputSchema.idBlock.hasOwnProperty(IS_CONSTRUCTED) === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (inputSchema.idBlock.isConstructed !== inputData.idBlock.isConstructed) {
      return {
        verified: false,
        result: root
      };
    }
    if (!(IS_HEX_ONLY in inputSchema.idBlock)) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema"
        }
      };
    }
    if (inputSchema.idBlock.isHexOnly !== inputData.idBlock.isHexOnly) {
      return {
        verified: false,
        result: root
      };
    }
    if (inputSchema.idBlock.isHexOnly) {
      if (VALUE_HEX_VIEW in inputSchema.idBlock === false) {
        return {
          verified: false,
          result: {
            error: "Wrong ASN.1 schema"
          }
        };
      }
      var schemaView = inputSchema.idBlock.valueHexView;
      var asn1View = inputData.idBlock.valueHexView;
      if (schemaView.length !== asn1View.length) {
        return {
          verified: false,
          result: root
        };
      }
      for (var i = 0; i < schemaView.length; i++) {
        if (schemaView[i] !== asn1View[1]) {
          return {
            verified: false,
            result: root
          };
        }
      }
    }
    if (inputSchema.name) {
      inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
      if (inputSchema.name) root[inputSchema.name] = inputData;
    }
    if (inputSchema instanceof typeStore.Constructed) {
      var admission = 0;
      var _result2 = {
        verified: false,
        result: {
          error: "Unknown error"
        }
      };
      var maxLength = inputSchema.valueBlock.value.length;
      if (maxLength > 0) {
        if (inputSchema.valueBlock.value[0] instanceof Repeated) {
          maxLength = inputData.valueBlock.value.length;
        }
      }
      if (maxLength === 0) {
        return {
          verified: true,
          result: root
        };
      }
      if (inputData.valueBlock.value.length === 0 && inputSchema.valueBlock.value.length !== 0) {
        var _optional = true;
        for (var _i12 = 0; _i12 < inputSchema.valueBlock.value.length; _i12++) _optional = _optional && (inputSchema.valueBlock.value[_i12].optional || false);
        if (_optional) {
          return {
            verified: true,
            result: root
          };
        }
        if (inputSchema.name) {
          inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
          if (inputSchema.name) delete root[inputSchema.name];
        }
        root.error = "Inconsistent object length";
        return {
          verified: false,
          result: root
        };
      }
      for (var _i13 = 0; _i13 < maxLength; _i13++) {
        if (_i13 - admission >= inputData.valueBlock.value.length) {
          if (inputSchema.valueBlock.value[_i13].optional === false) {
            var _result3 = {
              verified: false,
              result: root
            };
            root.error = "Inconsistent length between ASN.1 data and schema";
            if (inputSchema.name) {
              inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
              if (inputSchema.name) {
                delete root[inputSchema.name];
                _result3.name = inputSchema.name;
              }
            }
            return _result3;
          }
        } else {
          if (inputSchema.valueBlock.value[0] instanceof Repeated) {
            _result2 = compareSchema(root, inputData.valueBlock.value[_i13], inputSchema.valueBlock.value[0].value);
            if (_result2.verified === false) {
              if (inputSchema.valueBlock.value[0].optional) admission++;else {
                if (inputSchema.name) {
                  inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                  if (inputSchema.name) delete root[inputSchema.name];
                }
                return _result2;
              }
            }
            if (NAME in inputSchema.valueBlock.value[0] && inputSchema.valueBlock.value[0].name.length > 0) {
              var arrayRoot = {};
              if (LOCAL in inputSchema.valueBlock.value[0] && inputSchema.valueBlock.value[0].local) arrayRoot = inputData;else arrayRoot = root;
              if (typeof arrayRoot[inputSchema.valueBlock.value[0].name] === "undefined") arrayRoot[inputSchema.valueBlock.value[0].name] = [];
              arrayRoot[inputSchema.valueBlock.value[0].name].push(inputData.valueBlock.value[_i13]);
            }
          } else {
            _result2 = compareSchema(root, inputData.valueBlock.value[_i13 - admission], inputSchema.valueBlock.value[_i13]);
            if (_result2.verified === false) {
              if (inputSchema.valueBlock.value[_i13].optional) admission++;else {
                if (inputSchema.name) {
                  inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                  if (inputSchema.name) delete root[inputSchema.name];
                }
                return _result2;
              }
            }
          }
        }
      }
      if (_result2.verified === false) {
        var _result4 = {
          verified: false,
          result: root
        };
        if (inputSchema.name) {
          inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
          if (inputSchema.name) {
            delete root[inputSchema.name];
            _result4.name = inputSchema.name;
          }
        }
        return _result4;
      }
      return {
        verified: true,
        result: root
      };
    }
    if (inputSchema.primitiveSchema && VALUE_HEX_VIEW in inputData.valueBlock) {
      var asn1 = localFromBER(inputData.valueBlock.valueHexView);
      if (asn1.offset === -1) {
        var _result5 = {
          verified: false,
          result: asn1.result
        };
        if (inputSchema.name) {
          inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
          if (inputSchema.name) {
            delete root[inputSchema.name];
            _result5.name = inputSchema.name;
          }
        }
        return _result5;
      }
      return compareSchema(root, asn1.result, inputSchema.primitiveSchema);
    }
    return {
      verified: true,
      result: root
    };
  }
  function verifySchema(inputBuffer, inputSchema) {
    if (inputSchema instanceof Object === false) {
      return {
        verified: false,
        result: {
          error: "Wrong ASN.1 schema type"
        }
      };
    }
    var asn1 = localFromBER(BufferSourceConverter.toUint8Array(inputBuffer));
    if (asn1.offset === -1) {
      return {
        verified: false,
        result: asn1.result
      };
    }
    return compareSchema(asn1.result, asn1.result, inputSchema);
  }
  var asn1js = Object.freeze({
    __proto__: null,
    Any: Any,
    BaseBlock: BaseBlock,
    BaseStringBlock: BaseStringBlock,
    BitString: BitString$1,
    BmpString: BmpString,
    Boolean: Boolean,
    CharacterString: CharacterString,
    Choice: Choice,
    Constructed: Constructed,
    DATE: DATE,
    DateTime: DateTime,
    Duration: Duration,
    EndOfContent: EndOfContent,
    Enumerated: Enumerated,
    GeneralString: GeneralString,
    GeneralizedTime: GeneralizedTime,
    GraphicString: GraphicString,
    HexBlock: HexBlock,
    IA5String: IA5String,
    Integer: Integer,
    Null: Null,
    NumericString: NumericString,
    ObjectIdentifier: ObjectIdentifier$1,
    OctetString: OctetString$1,
    Primitive: Primitive,
    PrintableString: PrintableString,
    RawData: RawData,
    RelativeObjectIdentifier: RelativeObjectIdentifier,
    Repeated: Repeated,
    Sequence: Sequence,
    Set: Set,
    TIME: TIME,
    TeletexString: TeletexString,
    TimeOfDay: TimeOfDay,
    UTCTime: UTCTime,
    UniversalString: UniversalString,
    Utf8String: Utf8String,
    ValueBlock: ValueBlock,
    VideotexString: VideotexString,
    ViewWriter: ViewWriter,
    VisibleString: VisibleString,
    compareSchema: compareSchema,
    fromBER: fromBER,
    verifySchema: verifySchema
  });
  var AsnTypeTypes;
  (function (AsnTypeTypes) {
    AsnTypeTypes[AsnTypeTypes["Sequence"] = 0] = "Sequence";
    AsnTypeTypes[AsnTypeTypes["Set"] = 1] = "Set";
    AsnTypeTypes[AsnTypeTypes["Choice"] = 2] = "Choice";
  })(AsnTypeTypes || (AsnTypeTypes = {}));
  var AsnPropTypes;
  (function (AsnPropTypes) {
    AsnPropTypes[AsnPropTypes["Any"] = 1] = "Any";
    AsnPropTypes[AsnPropTypes["Boolean"] = 2] = "Boolean";
    AsnPropTypes[AsnPropTypes["OctetString"] = 3] = "OctetString";
    AsnPropTypes[AsnPropTypes["BitString"] = 4] = "BitString";
    AsnPropTypes[AsnPropTypes["Integer"] = 5] = "Integer";
    AsnPropTypes[AsnPropTypes["Enumerated"] = 6] = "Enumerated";
    AsnPropTypes[AsnPropTypes["ObjectIdentifier"] = 7] = "ObjectIdentifier";
    AsnPropTypes[AsnPropTypes["Utf8String"] = 8] = "Utf8String";
    AsnPropTypes[AsnPropTypes["BmpString"] = 9] = "BmpString";
    AsnPropTypes[AsnPropTypes["UniversalString"] = 10] = "UniversalString";
    AsnPropTypes[AsnPropTypes["NumericString"] = 11] = "NumericString";
    AsnPropTypes[AsnPropTypes["PrintableString"] = 12] = "PrintableString";
    AsnPropTypes[AsnPropTypes["TeletexString"] = 13] = "TeletexString";
    AsnPropTypes[AsnPropTypes["VideotexString"] = 14] = "VideotexString";
    AsnPropTypes[AsnPropTypes["IA5String"] = 15] = "IA5String";
    AsnPropTypes[AsnPropTypes["GraphicString"] = 16] = "GraphicString";
    AsnPropTypes[AsnPropTypes["VisibleString"] = 17] = "VisibleString";
    AsnPropTypes[AsnPropTypes["GeneralString"] = 18] = "GeneralString";
    AsnPropTypes[AsnPropTypes["CharacterString"] = 19] = "CharacterString";
    AsnPropTypes[AsnPropTypes["UTCTime"] = 20] = "UTCTime";
    AsnPropTypes[AsnPropTypes["GeneralizedTime"] = 21] = "GeneralizedTime";
    AsnPropTypes[AsnPropTypes["DATE"] = 22] = "DATE";
    AsnPropTypes[AsnPropTypes["TimeOfDay"] = 23] = "TimeOfDay";
    AsnPropTypes[AsnPropTypes["DateTime"] = 24] = "DateTime";
    AsnPropTypes[AsnPropTypes["Duration"] = 25] = "Duration";
    AsnPropTypes[AsnPropTypes["TIME"] = 26] = "TIME";
    AsnPropTypes[AsnPropTypes["Null"] = 27] = "Null";
  })(AsnPropTypes || (AsnPropTypes = {}));
  var OctetString = function () {
    function OctetString(param) {
      _classCallCheck(this, OctetString);
      if (typeof param === "number") {
        this.buffer = new ArrayBuffer(param);
      } else {
        if (BufferSourceConverter.isBufferSource(param)) {
          this.buffer = BufferSourceConverter.toArrayBuffer(param);
        } else if (Array.isArray(param)) {
          this.buffer = new Uint8Array(param);
        } else {
          this.buffer = new ArrayBuffer(0);
        }
      }
    }
    _createClass(OctetString, [{
      key: "byteLength",
      get: function get() {
        return this.buffer.byteLength;
      }
    }, {
      key: "byteOffset",
      get: function get() {
        return 0;
      }
    }, {
      key: "fromASN",
      value: function fromASN(asn) {
        if (!(asn instanceof OctetString$1)) {
          throw new TypeError("Argument 'asn' is not instance of ASN.1 OctetString");
        }
        this.buffer = asn.valueBlock.valueHex;
        return this;
      }
    }, {
      key: "toASN",
      value: function toASN() {
        return new OctetString$1({
          valueHex: this.buffer
        });
      }
    }, {
      key: "toSchema",
      value: function toSchema(name) {
        return new OctetString$1({
          name: name
        });
      }
    }]);
    return OctetString;
  }();
  var AsnAnyConverter = {
    fromASN: function fromASN(value) {
      return value instanceof Null ? null : value.valueBeforeDecodeView;
    },
    toASN: function toASN(value) {
      if (value === null) {
        return new Null();
      }
      var schema = fromBER(value);
      if (schema.result.error) {
        throw new Error(schema.result.error);
      }
      return schema.result;
    }
  };
  var AsnIntegerConverter = {
    fromASN: function fromASN(value) {
      return value.valueBlock.valueHexView.byteLength >= 4 ? value.valueBlock.toString() : value.valueBlock.valueDec;
    },
    toASN: function toASN(value) {
      return new Integer({
        value: +value
      });
    }
  };
  var AsnEnumeratedConverter = {
    fromASN: function fromASN(value) {
      return value.valueBlock.valueDec;
    },
    toASN: function toASN(value) {
      return new Enumerated({
        value: value
      });
    }
  };
  var AsnBitStringConverter = {
    fromASN: function fromASN(value) {
      return value.valueBlock.valueHexView;
    },
    toASN: function toASN(value) {
      return new BitString$1({
        valueHex: value
      });
    }
  };
  var AsnObjectIdentifierConverter = {
    fromASN: function fromASN(value) {
      return value.valueBlock.toString();
    },
    toASN: function toASN(value) {
      return new ObjectIdentifier$1({
        value: value
      });
    }
  };
  var AsnBooleanConverter = {
    fromASN: function fromASN(value) {
      return value.valueBlock.value;
    },
    toASN: function toASN(value) {
      return new Boolean({
        value: value
      });
    }
  };
  var AsnOctetStringConverter = {
    fromASN: function fromASN(value) {
      return value.valueBlock.valueHexView;
    },
    toASN: function toASN(value) {
      return new OctetString$1({
        valueHex: value
      });
    }
  };
  function createStringConverter(Asn1Type) {
    return {
      fromASN: function fromASN(value) {
        return value.valueBlock.value;
      },
      toASN: function toASN(value) {
        return new Asn1Type({
          value: value
        });
      }
    };
  }
  var AsnUtf8StringConverter = createStringConverter(Utf8String);
  var AsnBmpStringConverter = createStringConverter(BmpString);
  var AsnUniversalStringConverter = createStringConverter(UniversalString);
  var AsnNumericStringConverter = createStringConverter(NumericString);
  var AsnPrintableStringConverter = createStringConverter(PrintableString);
  var AsnTeletexStringConverter = createStringConverter(TeletexString);
  var AsnVideotexStringConverter = createStringConverter(VideotexString);
  var AsnIA5StringConverter = createStringConverter(IA5String);
  var AsnGraphicStringConverter = createStringConverter(GraphicString);
  var AsnVisibleStringConverter = createStringConverter(VisibleString);
  var AsnGeneralStringConverter = createStringConverter(GeneralString);
  var AsnCharacterStringConverter = createStringConverter(CharacterString);
  var AsnUTCTimeConverter = {
    fromASN: function fromASN(value) {
      return value.toDate();
    },
    toASN: function toASN(value) {
      return new UTCTime({
        valueDate: value
      });
    }
  };
  var AsnGeneralizedTimeConverter = {
    fromASN: function fromASN(value) {
      return value.toDate();
    },
    toASN: function toASN(value) {
      return new GeneralizedTime({
        valueDate: value
      });
    }
  };
  var AsnNullConverter = {
    fromASN: function fromASN() {
      return null;
    },
    toASN: function toASN() {
      return new Null();
    }
  };
  function defaultConverter(type) {
    switch (type) {
      case AsnPropTypes.Any:
        return AsnAnyConverter;
      case AsnPropTypes.BitString:
        return AsnBitStringConverter;
      case AsnPropTypes.BmpString:
        return AsnBmpStringConverter;
      case AsnPropTypes.Boolean:
        return AsnBooleanConverter;
      case AsnPropTypes.CharacterString:
        return AsnCharacterStringConverter;
      case AsnPropTypes.Enumerated:
        return AsnEnumeratedConverter;
      case AsnPropTypes.GeneralString:
        return AsnGeneralStringConverter;
      case AsnPropTypes.GeneralizedTime:
        return AsnGeneralizedTimeConverter;
      case AsnPropTypes.GraphicString:
        return AsnGraphicStringConverter;
      case AsnPropTypes.IA5String:
        return AsnIA5StringConverter;
      case AsnPropTypes.Integer:
        return AsnIntegerConverter;
      case AsnPropTypes.Null:
        return AsnNullConverter;
      case AsnPropTypes.NumericString:
        return AsnNumericStringConverter;
      case AsnPropTypes.ObjectIdentifier:
        return AsnObjectIdentifierConverter;
      case AsnPropTypes.OctetString:
        return AsnOctetStringConverter;
      case AsnPropTypes.PrintableString:
        return AsnPrintableStringConverter;
      case AsnPropTypes.TeletexString:
        return AsnTeletexStringConverter;
      case AsnPropTypes.UTCTime:
        return AsnUTCTimeConverter;
      case AsnPropTypes.UniversalString:
        return AsnUniversalStringConverter;
      case AsnPropTypes.Utf8String:
        return AsnUtf8StringConverter;
      case AsnPropTypes.VideotexString:
        return AsnVideotexStringConverter;
      case AsnPropTypes.VisibleString:
        return AsnVisibleStringConverter;
      default:
        return null;
    }
  }
  function isConvertible$1(target) {
    if (typeof target === "function" && target.prototype) {
      if (target.prototype.toASN && target.prototype.fromASN) {
        return true;
      } else {
        return isConvertible$1(target.prototype);
      }
    } else {
      return !!(target && _typeof(target) === "object" && "toASN" in target && "fromASN" in target);
    }
  }
  function isTypeOfArray(target) {
    var _a;
    if (target) {
      var _proto = Object.getPrototypeOf(target);
      if (((_a = _proto === null || _proto === void 0 ? void 0 : _proto.prototype) === null || _a === void 0 ? void 0 : _a.constructor) === Array) {
        return true;
      }
      return isTypeOfArray(_proto);
    }
    return false;
  }
  function isArrayEqual(bytes1, bytes2) {
    if (!(bytes1 && bytes2)) {
      return false;
    }
    if (bytes1.byteLength !== bytes2.byteLength) {
      return false;
    }
    var b1 = new Uint8Array(bytes1);
    var b2 = new Uint8Array(bytes2);
    for (var i = 0; i < bytes1.byteLength; i++) {
      if (b1[i] !== b2[i]) {
        return false;
      }
    }
    return true;
  }
  var AsnSchemaStorage = function () {
    function AsnSchemaStorage() {
      _classCallCheck(this, AsnSchemaStorage);
      this.items = new WeakMap();
    }
    _createClass(AsnSchemaStorage, [{
      key: "has",
      value: function has(target) {
        return this.items.has(target);
      }
    }, {
      key: "get",
      value: function get(target) {
        var checkSchema = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        var schema = this.items.get(target);
        if (!schema) {
          throw new Error("Cannot get schema for '".concat(target.prototype.constructor.name, "' target"));
        }
        if (checkSchema && !schema.schema) {
          throw new Error("Schema '".concat(target.prototype.constructor.name, "' doesn't contain ASN.1 schema. Call 'AsnSchemaStorage.cache'."));
        }
        return schema;
      }
    }, {
      key: "cache",
      value: function cache(target) {
        var schema = this.get(target);
        if (!schema.schema) {
          schema.schema = this.create(target, true);
        }
      }
    }, {
      key: "createDefault",
      value: function createDefault(target) {
        var schema = {
          type: AsnTypeTypes.Sequence,
          items: {}
        };
        var parentSchema = this.findParentSchema(target);
        if (parentSchema) {
          Object.assign(schema, parentSchema);
          schema.items = Object.assign({}, schema.items, parentSchema.items);
        }
        return schema;
      }
    }, {
      key: "create",
      value: function create(target, useNames) {
        var schema = this.items.get(target) || this.createDefault(target);
        var asn1Value = [];
        for (var key in schema.items) {
          var item = schema.items[key];
          var name = useNames ? key : "";
          var asn1Item = void 0;
          if (typeof item.type === "number") {
            var Asn1TypeName = AsnPropTypes[item.type];
            var Asn1Type = asn1js[Asn1TypeName];
            if (!Asn1Type) {
              throw new Error("Cannot get ASN1 class by name '".concat(Asn1TypeName, "'"));
            }
            asn1Item = new Asn1Type({
              name: name
            });
          } else if (isConvertible$1(item.type)) {
            var instance = new item.type();
            asn1Item = instance.toSchema(name);
          } else if (item.optional) {
            var itemSchema = this.get(item.type);
            if (itemSchema.type === AsnTypeTypes.Choice) {
              asn1Item = new Any({
                name: name
              });
            } else {
              asn1Item = this.create(item.type, false);
              asn1Item.name = name;
            }
          } else {
            asn1Item = new Any({
              name: name
            });
          }
          var optional = !!item.optional || item.defaultValue !== undefined;
          if (item.repeated) {
            asn1Item.name = "";
            var Container = item.repeated === "set" ? Set : Sequence;
            asn1Item = new Container({
              name: "",
              value: [new Repeated({
                name: name,
                value: asn1Item
              })]
            });
          }
          if (item.context !== null && item.context !== undefined) {
            if (item.implicit) {
              if (typeof item.type === "number" || isConvertible$1(item.type)) {
                var _Container = item.repeated ? Constructed : Primitive;
                asn1Value.push(new _Container({
                  name: name,
                  optional: optional,
                  idBlock: {
                    tagClass: 3,
                    tagNumber: item.context
                  }
                }));
              } else {
                this.cache(item.type);
                var isRepeated = !!item.repeated;
                var value = !isRepeated ? this.get(item.type, true).schema : asn1Item;
                value = "valueBlock" in value ? value.valueBlock.value : value.value;
                asn1Value.push(new Constructed({
                  name: !isRepeated ? name : "",
                  optional: optional,
                  idBlock: {
                    tagClass: 3,
                    tagNumber: item.context
                  },
                  value: value
                }));
              }
            } else {
              asn1Value.push(new Constructed({
                optional: optional,
                idBlock: {
                  tagClass: 3,
                  tagNumber: item.context
                },
                value: [asn1Item]
              }));
            }
          } else {
            asn1Item.optional = optional;
            asn1Value.push(asn1Item);
          }
        }
        switch (schema.type) {
          case AsnTypeTypes.Sequence:
            return new Sequence({
              value: asn1Value,
              name: ""
            });
          case AsnTypeTypes.Set:
            return new Set({
              value: asn1Value,
              name: ""
            });
          case AsnTypeTypes.Choice:
            return new Choice({
              value: asn1Value,
              name: ""
            });
          default:
            throw new Error("Unsupported ASN1 type in use");
        }
      }
    }, {
      key: "set",
      value: function set(target, schema) {
        this.items.set(target, schema);
        return this;
      }
    }, {
      key: "findParentSchema",
      value: function findParentSchema(target) {
        var parent = Object.getPrototypeOf(target);
        if (parent) {
          var schema = this.items.get(parent);
          return schema || this.findParentSchema(parent);
        }
        return null;
      }
    }]);
    return AsnSchemaStorage;
  }();
  var schemaStorage$1 = new AsnSchemaStorage();
  var AsnType = function AsnType(options) {
    return function (target) {
      var schema;
      if (!schemaStorage$1.has(target)) {
        schema = schemaStorage$1.createDefault(target);
        schemaStorage$1.set(target, schema);
      } else {
        schema = schemaStorage$1.get(target);
      }
      Object.assign(schema, options);
    };
  };
  var AsnProp = function AsnProp(options) {
    return function (target, propertyKey) {
      var schema;
      if (!schemaStorage$1.has(target.constructor)) {
        schema = schemaStorage$1.createDefault(target.constructor);
        schemaStorage$1.set(target.constructor, schema);
      } else {
        schema = schemaStorage$1.get(target.constructor);
      }
      var copyOptions = Object.assign({}, options);
      if (typeof copyOptions.type === "number" && !copyOptions.converter) {
        var defaultConverter$1 = defaultConverter(options.type);
        if (!defaultConverter$1) {
          throw new Error("Cannot get default converter for property '".concat(propertyKey, "' of ").concat(target.constructor.name));
        }
        copyOptions.converter = defaultConverter$1;
      }
      schema.items[propertyKey] = copyOptions;
    };
  };
  var AsnSchemaValidationError = function (_Error) {
    _inherits(AsnSchemaValidationError, _Error);
    function AsnSchemaValidationError() {
      var _this52;
      _classCallCheck(this, AsnSchemaValidationError);
      _this52 = _callSuper(this, AsnSchemaValidationError, arguments);
      _this52.schemas = [];
      return _this52;
    }
    return _createClass(AsnSchemaValidationError);
  }(_wrapNativeSuper(Error));
  var AsnParser = function () {
    function AsnParser() {
      _classCallCheck(this, AsnParser);
    }
    _createClass(AsnParser, null, [{
      key: "parse",
      value: function parse(data, target) {
        var asn1Parsed = fromBER(data);
        if (asn1Parsed.result.error) {
          throw new Error(asn1Parsed.result.error);
        }
        var res = this.fromASN(asn1Parsed.result, target);
        return res;
      }
    }, {
      key: "fromASN",
      value: function fromASN(asn1Schema, target) {
        var _this53 = this;
        var _a;
        try {
          if (isConvertible$1(target)) {
            var value = new target();
            return value.fromASN(asn1Schema);
          }
          var schema = schemaStorage$1.get(target);
          schemaStorage$1.cache(target);
          var targetSchema = schema.schema;
          if (asn1Schema.constructor === Constructed && schema.type !== AsnTypeTypes.Choice) {
            targetSchema = new Constructed({
              idBlock: {
                tagClass: 3,
                tagNumber: asn1Schema.idBlock.tagNumber
              },
              value: schema.schema.valueBlock.value
            });
            for (var key in schema.items) {
              delete asn1Schema[key];
            }
          }
          var asn1ComparedSchema = compareSchema({}, asn1Schema, targetSchema);
          if (!asn1ComparedSchema.verified) {
            throw new AsnSchemaValidationError("Data does not match to ".concat(target.name, " ASN1 schema. ").concat(asn1ComparedSchema.result.error));
          }
          var res = new target();
          if (isTypeOfArray(target)) {
            if (!("value" in asn1Schema.valueBlock && Array.isArray(asn1Schema.valueBlock.value))) {
              throw new Error("Cannot get items from the ASN.1 parsed value. ASN.1 object is not constructed.");
            }
            var itemType = schema.itemType;
            if (typeof itemType === "number") {
              var converter = defaultConverter(itemType);
              if (!converter) {
                throw new Error("Cannot get default converter for array item of ".concat(target.name, " ASN1 schema"));
              }
              return target.from(asn1Schema.valueBlock.value, function (element) {
                return converter.fromASN(element);
              });
            } else {
              return target.from(asn1Schema.valueBlock.value, function (element) {
                return _this53.fromASN(element, itemType);
              });
            }
          }
          var _loop = function _loop() {
            var asn1SchemaValue = asn1ComparedSchema.result[_key6];
            if (!asn1SchemaValue) {
              return 1;
            }
            var schemaItem = schema.items[_key6];
            var schemaItemType = schemaItem.type;
            if (typeof schemaItemType === "number" || isConvertible$1(schemaItemType)) {
              var _converter = (_a = schemaItem.converter) !== null && _a !== void 0 ? _a : isConvertible$1(schemaItemType) ? new schemaItemType() : null;
              if (!_converter) {
                throw new Error("Converter is empty");
              }
              if (schemaItem.repeated) {
                if (schemaItem.implicit) {
                  var Container = schemaItem.repeated === "sequence" ? Sequence : Set;
                  var newItem = new Container();
                  newItem.valueBlock = asn1SchemaValue.valueBlock;
                  var newItemAsn = fromBER(newItem.toBER(false));
                  if (newItemAsn.offset === -1) {
                    throw new Error("Cannot parse the child item. ".concat(newItemAsn.result.error));
                  }
                  if (!("value" in newItemAsn.result.valueBlock && Array.isArray(newItemAsn.result.valueBlock.value))) {
                    throw new Error("Cannot get items from the ASN.1 parsed value. ASN.1 object is not constructed.");
                  }
                  var _value = newItemAsn.result.valueBlock.value;
                  res[_key6] = Array.from(_value, function (element) {
                    return _converter.fromASN(element);
                  });
                } else {
                  res[_key6] = Array.from(asn1SchemaValue, function (element) {
                    return _converter.fromASN(element);
                  });
                }
              } else {
                var _value2 = asn1SchemaValue;
                if (schemaItem.implicit) {
                  var _newItem;
                  if (isConvertible$1(schemaItemType)) {
                    _newItem = new schemaItemType().toSchema("");
                  } else {
                    var Asn1TypeName = AsnPropTypes[schemaItemType];
                    var Asn1Type = asn1js[Asn1TypeName];
                    if (!Asn1Type) {
                      throw new Error("Cannot get '".concat(Asn1TypeName, "' class from asn1js module"));
                    }
                    _newItem = new Asn1Type();
                  }
                  _newItem.valueBlock = _value2.valueBlock;
                  _value2 = fromBER(_newItem.toBER(false)).result;
                }
                res[_key6] = _converter.fromASN(_value2);
              }
            } else {
              if (schemaItem.repeated) {
                if (!Array.isArray(asn1SchemaValue)) {
                  throw new Error("Cannot get list of items from the ASN.1 parsed value. ASN.1 value should be iterable.");
                }
                res[_key6] = Array.from(asn1SchemaValue, function (element) {
                  return _this53.fromASN(element, schemaItemType);
                });
              } else {
                res[_key6] = _this53.fromASN(asn1SchemaValue, schemaItemType);
              }
            }
          };
          for (var _key6 in schema.items) {
            if (_loop()) continue;
          }
          return res;
        } catch (error) {
          if (error instanceof AsnSchemaValidationError) {
            error.schemas.push(target.name);
          }
          throw error;
        }
      }
    }]);
    return AsnParser;
  }();
  var AsnSerializer = function () {
    function AsnSerializer() {
      _classCallCheck(this, AsnSerializer);
    }
    _createClass(AsnSerializer, null, [{
      key: "serialize",
      value: function serialize(obj) {
        if (obj instanceof BaseBlock) {
          return obj.toBER(false);
        }
        return this.toASN(obj).toBER(false);
      }
    }, {
      key: "toASN",
      value: function toASN(obj) {
        var _this54 = this;
        if (obj && _typeof(obj) === "object" && isConvertible$1(obj)) {
          return obj.toASN();
        }
        if (!(obj && _typeof(obj) === "object")) {
          throw new TypeError("Parameter 1 should be type of Object.");
        }
        var target = obj.constructor;
        var schema = schemaStorage$1.get(target);
        schemaStorage$1.cache(target);
        var asn1Value = [];
        if (schema.itemType) {
          if (!Array.isArray(obj)) {
            throw new TypeError("Parameter 1 should be type of Array.");
          }
          if (typeof schema.itemType === "number") {
            var converter = defaultConverter(schema.itemType);
            if (!converter) {
              throw new Error("Cannot get default converter for array item of ".concat(target.name, " ASN1 schema"));
            }
            asn1Value = obj.map(function (o) {
              return converter.toASN(o);
            });
          } else {
            asn1Value = obj.map(function (o) {
              return _this54.toAsnItem({
                type: schema.itemType
              }, "[]", target, o);
            });
          }
        } else {
          for (var key in schema.items) {
            var schemaItem = schema.items[key];
            var objProp = obj[key];
            if (objProp === undefined || schemaItem.defaultValue === objProp || _typeof(schemaItem.defaultValue) === "object" && _typeof(objProp) === "object" && isArrayEqual(this.serialize(schemaItem.defaultValue), this.serialize(objProp))) {
              continue;
            }
            var asn1Item = AsnSerializer.toAsnItem(schemaItem, key, target, objProp);
            if (typeof schemaItem.context === "number") {
              if (schemaItem.implicit) {
                if (!schemaItem.repeated && (typeof schemaItem.type === "number" || isConvertible$1(schemaItem.type))) {
                  var value = {};
                  value.valueHex = asn1Item instanceof Null ? asn1Item.valueBeforeDecodeView : asn1Item.valueBlock.toBER();
                  asn1Value.push(new Primitive(_objectSpread({
                    optional: schemaItem.optional,
                    idBlock: {
                      tagClass: 3,
                      tagNumber: schemaItem.context
                    }
                  }, value)));
                } else {
                  asn1Value.push(new Constructed({
                    optional: schemaItem.optional,
                    idBlock: {
                      tagClass: 3,
                      tagNumber: schemaItem.context
                    },
                    value: asn1Item.valueBlock.value
                  }));
                }
              } else {
                asn1Value.push(new Constructed({
                  optional: schemaItem.optional,
                  idBlock: {
                    tagClass: 3,
                    tagNumber: schemaItem.context
                  },
                  value: [asn1Item]
                }));
              }
            } else if (schemaItem.repeated) {
              asn1Value = asn1Value.concat(asn1Item);
            } else {
              asn1Value.push(asn1Item);
            }
          }
        }
        var asnSchema;
        switch (schema.type) {
          case AsnTypeTypes.Sequence:
            asnSchema = new Sequence({
              value: asn1Value
            });
            break;
          case AsnTypeTypes.Set:
            asnSchema = new Set({
              value: asn1Value
            });
            break;
          case AsnTypeTypes.Choice:
            if (!asn1Value[0]) {
              throw new Error("Schema '".concat(target.name, "' has wrong data. Choice cannot be empty."));
            }
            asnSchema = asn1Value[0];
            break;
        }
        return asnSchema;
      }
    }, {
      key: "toAsnItem",
      value: function toAsnItem(schemaItem, key, target, objProp) {
        var _this55 = this;
        var asn1Item;
        if (typeof schemaItem.type === "number") {
          var converter = schemaItem.converter;
          if (!converter) {
            throw new Error("Property '".concat(key, "' doesn't have converter for type ").concat(AsnPropTypes[schemaItem.type], " in schema '").concat(target.name, "'"));
          }
          if (schemaItem.repeated) {
            if (!Array.isArray(objProp)) {
              throw new TypeError("Parameter 'objProp' should be type of Array.");
            }
            var items = Array.from(objProp, function (element) {
              return converter.toASN(element);
            });
            var Container = schemaItem.repeated === "sequence" ? Sequence : Set;
            asn1Item = new Container({
              value: items
            });
          } else {
            asn1Item = converter.toASN(objProp);
          }
        } else {
          if (schemaItem.repeated) {
            if (!Array.isArray(objProp)) {
              throw new TypeError("Parameter 'objProp' should be type of Array.");
            }
            var _items = Array.from(objProp, function (element) {
              return _this55.toASN(element);
            });
            var _Container2 = schemaItem.repeated === "sequence" ? Sequence : Set;
            asn1Item = new _Container2({
              value: _items
            });
          } else {
            asn1Item = this.toASN(objProp);
          }
        }
        return asn1Item;
      }
    }]);
    return AsnSerializer;
  }();
  var AsnConvert = function () {
    function AsnConvert() {
      _classCallCheck(this, AsnConvert);
    }
    _createClass(AsnConvert, null, [{
      key: "serialize",
      value: function serialize(obj) {
        return AsnSerializer.serialize(obj);
      }
    }, {
      key: "parse",
      value: function parse(data, target) {
        return AsnParser.parse(data, target);
      }
    }, {
      key: "toString",
      value: function toString(data) {
        var buf = BufferSourceConverter.isBufferSource(data) ? BufferSourceConverter.toArrayBuffer(data) : AsnConvert.serialize(data);
        var asn = fromBER(buf);
        if (asn.offset === -1) {
          throw new Error("Cannot decode ASN.1 data. ".concat(asn.result.error));
        }
        return asn.result.toString();
      }
    }]);
    return AsnConvert;
  }();
  function __decorate(decorators, target, key, desc) {
    var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
    if ((typeof Reflect === "undefined" ? "undefined" : _typeof(Reflect)) === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  }
  function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function (resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }
  typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
  };
  var JsonError = function (_Error2) {
    _inherits(JsonError, _Error2);
    function JsonError(message, innerError) {
      var _this56;
      _classCallCheck(this, JsonError);
      _this56 = _callSuper(this, JsonError, [innerError ? "".concat(message, ". See the inner exception for more details.") : message]);
      _this56.message = message;
      _this56.innerError = innerError;
      return _this56;
    }
    return _createClass(JsonError);
  }(_wrapNativeSuper(Error));
  var TransformError = function (_JsonError) {
    _inherits(TransformError, _JsonError);
    function TransformError(schema, message, innerError) {
      var _this57;
      _classCallCheck(this, TransformError);
      _this57 = _callSuper(this, TransformError, [message, innerError]);
      _this57.schema = schema;
      return _this57;
    }
    return _createClass(TransformError);
  }(JsonError);
  var ParserError = function (_TransformError) {
    _inherits(ParserError, _TransformError);
    function ParserError(schema, message, innerError) {
      _classCallCheck(this, ParserError);
      return _callSuper(this, ParserError, [schema, "JSON doesn't match to '".concat(schema.target.name, "' schema. ").concat(message), innerError]);
    }
    return _createClass(ParserError);
  }(TransformError);
  var ValidationError = function (_JsonError2) {
    _inherits(ValidationError, _JsonError2);
    function ValidationError() {
      _classCallCheck(this, ValidationError);
      return _callSuper(this, ValidationError, arguments);
    }
    return _createClass(ValidationError);
  }(JsonError);
  var SerializerError = function (_JsonError3) {
    _inherits(SerializerError, _JsonError3);
    function SerializerError(schemaName, message, innerError) {
      var _this58;
      _classCallCheck(this, SerializerError);
      _this58 = _callSuper(this, SerializerError, ["Cannot serialize by '".concat(schemaName, "' schema. ").concat(message), innerError]);
      _this58.schemaName = schemaName;
      return _this58;
    }
    return _createClass(SerializerError);
  }(JsonError);
  var KeyError = function (_ParserError) {
    _inherits(KeyError, _ParserError);
    function KeyError(schema, keys) {
      var _this59;
      var errors = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      _classCallCheck(this, KeyError);
      _this59 = _callSuper(this, KeyError, [schema, "Some keys doesn't match to schema"]);
      _this59.keys = keys;
      _this59.errors = errors;
      return _this59;
    }
    return _createClass(KeyError);
  }(ParserError);
  var JsonPropTypes;
  (function (JsonPropTypes) {
    JsonPropTypes[JsonPropTypes["Any"] = 0] = "Any";
    JsonPropTypes[JsonPropTypes["Boolean"] = 1] = "Boolean";
    JsonPropTypes[JsonPropTypes["Number"] = 2] = "Number";
    JsonPropTypes[JsonPropTypes["String"] = 3] = "String";
  })(JsonPropTypes || (JsonPropTypes = {}));
  function checkType(value, type) {
    switch (type) {
      case JsonPropTypes.Boolean:
        return typeof value === "boolean";
      case JsonPropTypes.Number:
        return typeof value === "number";
      case JsonPropTypes.String:
        return typeof value === "string";
    }
    return true;
  }
  function throwIfTypeIsWrong(value, type) {
    if (!checkType(value, type)) {
      throw new TypeError("Value must be ".concat(JsonPropTypes[type]));
    }
  }
  function isConvertible(target) {
    if (target && target.prototype) {
      if (target.prototype.toJSON && target.prototype.fromJSON) {
        return true;
      } else {
        return isConvertible(target.prototype);
      }
    } else {
      return !!(target && target.toJSON && target.fromJSON);
    }
  }
  var JsonSchemaStorage = function () {
    function JsonSchemaStorage() {
      _classCallCheck(this, JsonSchemaStorage);
      this.items = new Map();
    }
    _createClass(JsonSchemaStorage, [{
      key: "has",
      value: function has(target) {
        return this.items.has(target) || !!this.findParentSchema(target);
      }
    }, {
      key: "get",
      value: function get(target) {
        var schema = this.items.get(target) || this.findParentSchema(target);
        if (!schema) {
          throw new Error("Cannot get schema for current target");
        }
        return schema;
      }
    }, {
      key: "create",
      value: function create(target) {
        var schema = {
          names: {}
        };
        var parentSchema = this.findParentSchema(target);
        if (parentSchema) {
          Object.assign(schema, parentSchema);
          schema.names = {};
          for (var name in parentSchema.names) {
            schema.names[name] = Object.assign({}, parentSchema.names[name]);
          }
        }
        schema.target = target;
        return schema;
      }
    }, {
      key: "set",
      value: function set(target, schema) {
        this.items.set(target, schema);
        return this;
      }
    }, {
      key: "findParentSchema",
      value: function findParentSchema(target) {
        var parent = target.__proto__;
        if (parent) {
          var schema = this.items.get(parent);
          return schema || this.findParentSchema(parent);
        }
        return null;
      }
    }]);
    return JsonSchemaStorage;
  }();
  var DEFAULT_SCHEMA = "default";
  var schemaStorage = new JsonSchemaStorage();
  var PatternValidation = function () {
    function PatternValidation(pattern) {
      _classCallCheck(this, PatternValidation);
      this.pattern = new RegExp(pattern);
    }
    _createClass(PatternValidation, [{
      key: "validate",
      value: function validate(value) {
        var pattern = new RegExp(this.pattern.source, this.pattern.flags);
        if (typeof value !== "string") {
          throw new ValidationError("Incoming value must be string");
        }
        if (!pattern.exec(value)) {
          throw new ValidationError("Value doesn't match to pattern '".concat(pattern.toString(), "'"));
        }
      }
    }]);
    return PatternValidation;
  }();
  var InclusiveValidation = function () {
    function InclusiveValidation() {
      var min = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Number.MIN_VALUE;
      var max = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Number.MAX_VALUE;
      _classCallCheck(this, InclusiveValidation);
      this.min = min;
      this.max = max;
    }
    _createClass(InclusiveValidation, [{
      key: "validate",
      value: function validate(value) {
        throwIfTypeIsWrong(value, JsonPropTypes.Number);
        if (!(this.min <= value && value <= this.max)) {
          var min = this.min === Number.MIN_VALUE ? "MIN" : this.min;
          var max = this.max === Number.MAX_VALUE ? "MAX" : this.max;
          throw new ValidationError("Value doesn't match to diapason [".concat(min, ",").concat(max, "]"));
        }
      }
    }]);
    return InclusiveValidation;
  }();
  var ExclusiveValidation = function () {
    function ExclusiveValidation() {
      var min = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Number.MIN_VALUE;
      var max = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Number.MAX_VALUE;
      _classCallCheck(this, ExclusiveValidation);
      this.min = min;
      this.max = max;
    }
    _createClass(ExclusiveValidation, [{
      key: "validate",
      value: function validate(value) {
        throwIfTypeIsWrong(value, JsonPropTypes.Number);
        if (!(this.min < value && value < this.max)) {
          var min = this.min === Number.MIN_VALUE ? "MIN" : this.min;
          var max = this.max === Number.MAX_VALUE ? "MAX" : this.max;
          throw new ValidationError("Value doesn't match to diapason (".concat(min, ",").concat(max, ")"));
        }
      }
    }]);
    return ExclusiveValidation;
  }();
  var LengthValidation = function () {
    function LengthValidation(length, minLength, maxLength) {
      _classCallCheck(this, LengthValidation);
      this.length = length;
      this.minLength = minLength;
      this.maxLength = maxLength;
    }
    _createClass(LengthValidation, [{
      key: "validate",
      value: function validate(value) {
        if (this.length !== undefined) {
          if (value.length !== this.length) {
            throw new ValidationError("Value length must be exactly ".concat(this.length, "."));
          }
          return;
        }
        if (this.minLength !== undefined) {
          if (value.length < this.minLength) {
            throw new ValidationError("Value length must be more than ".concat(this.minLength, "."));
          }
        }
        if (this.maxLength !== undefined) {
          if (value.length > this.maxLength) {
            throw new ValidationError("Value length must be less than ".concat(this.maxLength, "."));
          }
        }
      }
    }]);
    return LengthValidation;
  }();
  var EnumerationValidation = function () {
    function EnumerationValidation(enumeration) {
      _classCallCheck(this, EnumerationValidation);
      this.enumeration = enumeration;
    }
    _createClass(EnumerationValidation, [{
      key: "validate",
      value: function validate(value) {
        throwIfTypeIsWrong(value, JsonPropTypes.String);
        if (!this.enumeration.includes(value)) {
          throw new ValidationError("Value must be one of ".concat(this.enumeration.map(function (v) {
            return "'".concat(v, "'");
          }).join(", ")));
        }
      }
    }]);
    return EnumerationValidation;
  }();
  var JsonTransform = function () {
    function JsonTransform() {
      _classCallCheck(this, JsonTransform);
    }
    _createClass(JsonTransform, null, [{
      key: "checkValues",
      value: function checkValues(data, schemaItem) {
        var values = Array.isArray(data) ? data : [data];
        var _iterator11 = _createForOfIteratorHelper(values),
          _step11;
        try {
          for (_iterator11.s(); !(_step11 = _iterator11.n()).done;) {
            var value = _step11.value;
            var _iterator12 = _createForOfIteratorHelper(schemaItem.validations),
              _step12;
            try {
              for (_iterator12.s(); !(_step12 = _iterator12.n()).done;) {
                var validation = _step12.value;
                if (validation instanceof LengthValidation && schemaItem.repeated) {
                  validation.validate(data);
                } else {
                  validation.validate(value);
                }
              }
            } catch (err) {
              _iterator12.e(err);
            } finally {
              _iterator12.f();
            }
          }
        } catch (err) {
          _iterator11.e(err);
        } finally {
          _iterator11.f();
        }
      }
    }, {
      key: "checkTypes",
      value: function checkTypes(value, schemaItem) {
        if (schemaItem.repeated && !Array.isArray(value)) {
          throw new TypeError("Value must be Array");
        }
        if (typeof schemaItem.type === "number") {
          var values = Array.isArray(value) ? value : [value];
          var _iterator13 = _createForOfIteratorHelper(values),
            _step13;
          try {
            for (_iterator13.s(); !(_step13 = _iterator13.n()).done;) {
              var v = _step13.value;
              throwIfTypeIsWrong(v, schemaItem.type);
            }
          } catch (err) {
            _iterator13.e(err);
          } finally {
            _iterator13.f();
          }
        }
      }
    }, {
      key: "getSchemaByName",
      value: function getSchemaByName(schema) {
        var name = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_SCHEMA;
        return _objectSpread(_objectSpread({}, schema.names[DEFAULT_SCHEMA]), schema.names[name]);
      }
    }]);
    return JsonTransform;
  }();
  var JsonSerializer = function (_JsonTransform) {
    _inherits(JsonSerializer, _JsonTransform);
    function JsonSerializer() {
      _classCallCheck(this, JsonSerializer);
      return _callSuper(this, JsonSerializer, arguments);
    }
    _createClass(JsonSerializer, null, [{
      key: "serialize",
      value: function serialize(obj, options, replacer, space) {
        var json = this.toJSON(obj, options);
        return JSON.stringify(json, replacer, space);
      }
    }, {
      key: "toJSON",
      value: function toJSON(obj) {
        var _this60 = this;
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var res;
        var targetSchema = options.targetSchema;
        var schemaName = options.schemaName || DEFAULT_SCHEMA;
        if (isConvertible(obj)) {
          return obj.toJSON();
        }
        if (Array.isArray(obj)) {
          res = [];
          var _iterator14 = _createForOfIteratorHelper(obj),
            _step14;
          try {
            for (_iterator14.s(); !(_step14 = _iterator14.n()).done;) {
              var item = _step14.value;
              res.push(this.toJSON(item, options));
            }
          } catch (err) {
            _iterator14.e(err);
          } finally {
            _iterator14.f();
          }
        } else if (_typeof(obj) === "object") {
          if (targetSchema && !schemaStorage.has(targetSchema)) {
            throw new JsonError("Cannot get schema for `targetSchema` param");
          }
          targetSchema = targetSchema || obj.constructor;
          if (schemaStorage.has(targetSchema)) {
            var schema = schemaStorage.get(targetSchema);
            res = {};
            var namedSchema = this.getSchemaByName(schema, schemaName);
            var _loop2 = function _loop2() {
              try {
                var _item = namedSchema[key];
                var objItem = obj[key];
                var value;
                if (_item.optional && objItem === undefined || _item.defaultValue !== undefined && objItem === _item.defaultValue) {
                  return 1;
                }
                if (!_item.optional && objItem === undefined) {
                  throw new SerializerError(targetSchema.name, "Property '".concat(key, "' is required."));
                }
                if (typeof _item.type === "number") {
                  if (_item.converter) {
                    if (_item.repeated) {
                      value = objItem.map(function (el) {
                        return _item.converter.toJSON(el, obj);
                      });
                    } else {
                      value = _item.converter.toJSON(objItem, obj);
                    }
                  } else {
                    value = objItem;
                  }
                } else {
                  if (_item.repeated) {
                    value = objItem.map(function (el) {
                      return _this60.toJSON(el, {
                        schemaName: schemaName
                      });
                    });
                  } else {
                    value = _this60.toJSON(objItem, {
                      schemaName: schemaName
                    });
                  }
                }
                _this60.checkTypes(value, _item);
                _this60.checkValues(value, _item);
                res[_item.name || key] = value;
              } catch (e) {
                if (e instanceof SerializerError) {
                  throw e;
                } else {
                  throw new SerializerError(schema.target.name, "Property '".concat(key, "' is wrong. ").concat(e.message), e);
                }
              }
            };
            for (var key in namedSchema) {
              if (_loop2()) continue;
            }
          } else {
            res = {};
            for (var _key7 in obj) {
              res[_key7] = this.toJSON(obj[_key7], {
                schemaName: schemaName
              });
            }
          }
        } else {
          res = obj;
        }
        return res;
      }
    }]);
    return JsonSerializer;
  }(JsonTransform);
  var JsonParser = function (_JsonTransform2) {
    _inherits(JsonParser, _JsonTransform2);
    function JsonParser() {
      _classCallCheck(this, JsonParser);
      return _callSuper(this, JsonParser, arguments);
    }
    _createClass(JsonParser, null, [{
      key: "parse",
      value: function parse(data, options) {
        var obj = JSON.parse(data);
        return this.fromJSON(obj, options);
      }
    }, {
      key: "fromJSON",
      value: function fromJSON(target, options) {
        var _this61 = this;
        var targetSchema = options.targetSchema;
        var schemaName = options.schemaName || DEFAULT_SCHEMA;
        var obj = new targetSchema();
        if (isConvertible(obj)) {
          return obj.fromJSON(target);
        }
        var schema = schemaStorage.get(targetSchema);
        var namedSchema = this.getSchemaByName(schema, schemaName);
        var keyErrors = {};
        if (options.strictProperty && !Array.isArray(target)) {
          JsonParser.checkStrictProperty(target, namedSchema, schema);
        }
        var _loop3 = function _loop3() {
          try {
            var item = namedSchema[key];
            var name = item.name || key;
            var value = target[name];
            if (value === undefined && (item.optional || item.defaultValue !== undefined)) {
              return 1;
            }
            if (!item.optional && value === undefined) {
              throw new ParserError(schema, "Property '".concat(name, "' is required."));
            }
            _this61.checkTypes(value, item);
            _this61.checkValues(value, item);
            if (typeof item.type === "number") {
              if (item.converter) {
                if (item.repeated) {
                  obj[key] = value.map(function (el) {
                    return item.converter.fromJSON(el, obj);
                  });
                } else {
                  obj[key] = item.converter.fromJSON(value, obj);
                }
              } else {
                obj[key] = value;
              }
            } else {
              var newOptions = _objectSpread(_objectSpread({}, options), {}, {
                targetSchema: item.type,
                schemaName: schemaName
              });
              if (item.repeated) {
                obj[key] = value.map(function (el) {
                  return _this61.fromJSON(el, newOptions);
                });
              } else {
                obj[key] = _this61.fromJSON(value, newOptions);
              }
            }
          } catch (e) {
            if (!(e instanceof ParserError)) {
              e = new ParserError(schema, "Property '".concat(key, "' is wrong. ").concat(e.message), e);
            }
            if (options.strictAllKeys) {
              keyErrors[key] = e;
            } else {
              throw e;
            }
          }
        };
        for (var key in namedSchema) {
          if (_loop3()) continue;
        }
        var keys = Object.keys(keyErrors);
        if (keys.length) {
          throw new KeyError(schema, keys, keyErrors);
        }
        return obj;
      }
    }, {
      key: "checkStrictProperty",
      value: function checkStrictProperty(target, namedSchema, schema) {
        var jsonProps = Object.keys(target);
        var schemaProps = Object.keys(namedSchema);
        var keys = [];
        for (var _i14 = 0, _jsonProps = jsonProps; _i14 < _jsonProps.length; _i14++) {
          var key = _jsonProps[_i14];
          if (schemaProps.indexOf(key) === -1) {
            keys.push(key);
          }
        }
        if (keys.length) {
          throw new KeyError(schema, keys);
        }
      }
    }]);
    return JsonParser;
  }(JsonTransform);
  function getValidations(item) {
    var validations = [];
    if (item.pattern) {
      validations.push(new PatternValidation(item.pattern));
    }
    if (item.type === JsonPropTypes.Number || item.type === JsonPropTypes.Any) {
      if (item.minInclusive !== undefined || item.maxInclusive !== undefined) {
        validations.push(new InclusiveValidation(item.minInclusive, item.maxInclusive));
      }
      if (item.minExclusive !== undefined || item.maxExclusive !== undefined) {
        validations.push(new ExclusiveValidation(item.minExclusive, item.maxExclusive));
      }
      if (item.enumeration !== undefined) {
        validations.push(new EnumerationValidation(item.enumeration));
      }
    }
    if (item.type === JsonPropTypes.String || item.repeated || item.type === JsonPropTypes.Any) {
      if (item.length !== undefined || item.minLength !== undefined || item.maxLength !== undefined) {
        validations.push(new LengthValidation(item.length, item.minLength, item.maxLength));
      }
    }
    return validations;
  }
  var JsonProp = function JsonProp() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return function (target, propertyKey) {
      var errorMessage = "Cannot set type for ".concat(propertyKey, " property of ").concat(target.constructor.name, " schema");
      var schema;
      if (!schemaStorage.has(target.constructor)) {
        schema = schemaStorage.create(target.constructor);
        schemaStorage.set(target.constructor, schema);
      } else {
        schema = schemaStorage.get(target.constructor);
        if (schema.target !== target.constructor) {
          schema = schemaStorage.create(target.constructor);
          schemaStorage.set(target.constructor, schema);
        }
      }
      var defaultSchema = {
        type: JsonPropTypes.Any,
        validations: []
      };
      var copyOptions = Object.assign(defaultSchema, options);
      copyOptions.validations = getValidations(copyOptions);
      if (typeof copyOptions.type !== "number") {
        if (!schemaStorage.has(copyOptions.type) && !isConvertible(copyOptions.type)) {
          throw new Error("".concat(errorMessage, ". Assigning type doesn't have schema."));
        }
      }
      var schemaNames;
      if (Array.isArray(options.schema)) {
        schemaNames = options.schema;
      } else {
        schemaNames = [options.schema || DEFAULT_SCHEMA];
      }
      var _iterator15 = _createForOfIteratorHelper(schemaNames),
        _step15;
      try {
        for (_iterator15.s(); !(_step15 = _iterator15.n()).done;) {
          var schemaName = _step15.value;
          if (!schema.names[schemaName]) {
            schema.names[schemaName] = {};
          }
          var namedSchema = schema.names[schemaName];
          namedSchema[propertyKey] = copyOptions;
        }
      } catch (err) {
        _iterator15.e(err);
      } finally {
        _iterator15.f();
      }
    };
  };
  var CryptoError = function (_Error3) {
    _inherits(CryptoError, _Error3);
    function CryptoError() {
      _classCallCheck(this, CryptoError);
      return _callSuper(this, CryptoError, arguments);
    }
    return _createClass(CryptoError);
  }(_wrapNativeSuper(Error));
  var AlgorithmError = function (_CryptoError) {
    _inherits(AlgorithmError, _CryptoError);
    function AlgorithmError() {
      _classCallCheck(this, AlgorithmError);
      return _callSuper(this, AlgorithmError, arguments);
    }
    return _createClass(AlgorithmError);
  }(CryptoError);
  var UnsupportedOperationError = function (_CryptoError2) {
    _inherits(UnsupportedOperationError, _CryptoError2);
    function UnsupportedOperationError(methodName) {
      _classCallCheck(this, UnsupportedOperationError);
      return _callSuper(this, UnsupportedOperationError, ["Unsupported operation: ".concat(methodName ? "".concat(methodName) : "")]);
    }
    return _createClass(UnsupportedOperationError);
  }(CryptoError);
  var OperationError = function (_CryptoError3) {
    _inherits(OperationError, _CryptoError3);
    function OperationError() {
      _classCallCheck(this, OperationError);
      return _callSuper(this, OperationError, arguments);
    }
    return _createClass(OperationError);
  }(CryptoError);
  var RequiredPropertyError = function (_CryptoError4) {
    _inherits(RequiredPropertyError, _CryptoError4);
    function RequiredPropertyError(propName) {
      _classCallCheck(this, RequiredPropertyError);
      return _callSuper(this, RequiredPropertyError, ["".concat(propName, ": Missing required property")]);
    }
    return _createClass(RequiredPropertyError);
  }(CryptoError);
  function isJWK(data) {
    return _typeof(data) === "object" && "kty" in data;
  }
  var ProviderCrypto = function () {
    function ProviderCrypto() {
      _classCallCheck(this, ProviderCrypto);
    }
    _createClass(ProviderCrypto, [{
      key: "digest",
      value: function () {
        var _digest = _asyncToGenerator(_regeneratorRuntime().mark(function _callee() {
          var _len5,
            args,
            _key8,
            _args2 = arguments;
          return _regeneratorRuntime().wrap(function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                for (_len5 = _args2.length, args = new Array(_len5), _key8 = 0; _key8 < _len5; _key8++) {
                  args[_key8] = _args2[_key8];
                }
                this.checkDigest.apply(this, args);
                return _context.abrupt("return", this.onDigest.apply(this, args));
              case 3:
              case "end":
                return _context.stop();
            }
          }, _callee, this);
        }));
        function digest() {
          return _digest.apply(this, arguments);
        }
        return digest;
      }()
    }, {
      key: "checkDigest",
      value: function checkDigest(algorithm, _data) {
        this.checkAlgorithmName(algorithm);
      }
    }, {
      key: "onDigest",
      value: function () {
        var _onDigest = _asyncToGenerator(_regeneratorRuntime().mark(function _callee2(_algorithm, _data) {
          return _regeneratorRuntime().wrap(function _callee2$(_context2) {
            while (1) switch (_context2.prev = _context2.next) {
              case 0:
                throw new UnsupportedOperationError("digest");
              case 1:
              case "end":
                return _context2.stop();
            }
          }, _callee2);
        }));
        function onDigest(_x, _x2) {
          return _onDigest.apply(this, arguments);
        }
        return onDigest;
      }()
    }, {
      key: "generateKey",
      value: function () {
        var _generateKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee3() {
          var _len6,
            args,
            _key9,
            _args4 = arguments;
          return _regeneratorRuntime().wrap(function _callee3$(_context3) {
            while (1) switch (_context3.prev = _context3.next) {
              case 0:
                for (_len6 = _args4.length, args = new Array(_len6), _key9 = 0; _key9 < _len6; _key9++) {
                  args[_key9] = _args4[_key9];
                }
                this.checkGenerateKey.apply(this, args);
                return _context3.abrupt("return", this.onGenerateKey.apply(this, args));
              case 3:
              case "end":
                return _context3.stop();
            }
          }, _callee3, this);
        }));
        function generateKey() {
          return _generateKey.apply(this, arguments);
        }
        return generateKey;
      }()
    }, {
      key: "checkGenerateKey",
      value: function checkGenerateKey(algorithm, _extractable, keyUsages) {
        this.checkAlgorithmName(algorithm);
        this.checkGenerateKeyParams(algorithm);
        if (!(keyUsages && keyUsages.length)) {
          throw new TypeError("Usages cannot be empty when creating a key.");
        }
        var allowedUsages;
        if (Array.isArray(this.usages)) {
          allowedUsages = this.usages;
        } else {
          allowedUsages = this.usages.privateKey.concat(this.usages.publicKey);
        }
        this.checkKeyUsages(keyUsages, allowedUsages);
      }
    }, {
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(_algorithm) {}
    }, {
      key: "onGenerateKey",
      value: function () {
        var _onGenerateKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee4(_algorithm, _extractable, _keyUsages) {
          return _regeneratorRuntime().wrap(function _callee4$(_context4) {
            while (1) switch (_context4.prev = _context4.next) {
              case 0:
                throw new UnsupportedOperationError("generateKey");
              case 1:
              case "end":
                return _context4.stop();
            }
          }, _callee4);
        }));
        function onGenerateKey(_x3, _x4, _x5) {
          return _onGenerateKey.apply(this, arguments);
        }
        return onGenerateKey;
      }()
    }, {
      key: "sign",
      value: function () {
        var _sign = _asyncToGenerator(_regeneratorRuntime().mark(function _callee5() {
          var _len7,
            args,
            _key10,
            _args6 = arguments;
          return _regeneratorRuntime().wrap(function _callee5$(_context5) {
            while (1) switch (_context5.prev = _context5.next) {
              case 0:
                for (_len7 = _args6.length, args = new Array(_len7), _key10 = 0; _key10 < _len7; _key10++) {
                  args[_key10] = _args6[_key10];
                }
                this.checkSign.apply(this, args);
                return _context5.abrupt("return", this.onSign.apply(this, args));
              case 3:
              case "end":
                return _context5.stop();
            }
          }, _callee5, this);
        }));
        function sign() {
          return _sign.apply(this, arguments);
        }
        return sign;
      }()
    }, {
      key: "checkSign",
      value: function checkSign(algorithm, key, _data) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, "sign");
      }
    }, {
      key: "onSign",
      value: function () {
        var _onSign = _asyncToGenerator(_regeneratorRuntime().mark(function _callee6(_algorithm, _key, _data) {
          return _regeneratorRuntime().wrap(function _callee6$(_context6) {
            while (1) switch (_context6.prev = _context6.next) {
              case 0:
                throw new UnsupportedOperationError("sign");
              case 1:
              case "end":
                return _context6.stop();
            }
          }, _callee6);
        }));
        function onSign(_x6, _x7, _x8) {
          return _onSign.apply(this, arguments);
        }
        return onSign;
      }()
    }, {
      key: "verify",
      value: function () {
        var _verify = _asyncToGenerator(_regeneratorRuntime().mark(function _callee7() {
          var _len8,
            args,
            _key11,
            _args8 = arguments;
          return _regeneratorRuntime().wrap(function _callee7$(_context7) {
            while (1) switch (_context7.prev = _context7.next) {
              case 0:
                for (_len8 = _args8.length, args = new Array(_len8), _key11 = 0; _key11 < _len8; _key11++) {
                  args[_key11] = _args8[_key11];
                }
                this.checkVerify.apply(this, args);
                return _context7.abrupt("return", this.onVerify.apply(this, args));
              case 3:
              case "end":
                return _context7.stop();
            }
          }, _callee7, this);
        }));
        function verify() {
          return _verify.apply(this, arguments);
        }
        return verify;
      }()
    }, {
      key: "checkVerify",
      value: function checkVerify(algorithm, key, _signature, _data) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, "verify");
      }
    }, {
      key: "onVerify",
      value: function () {
        var _onVerify = _asyncToGenerator(_regeneratorRuntime().mark(function _callee8(_algorithm, _key, _signature, _data) {
          return _regeneratorRuntime().wrap(function _callee8$(_context8) {
            while (1) switch (_context8.prev = _context8.next) {
              case 0:
                throw new UnsupportedOperationError("verify");
              case 1:
              case "end":
                return _context8.stop();
            }
          }, _callee8);
        }));
        function onVerify(_x9, _x10, _x11, _x12) {
          return _onVerify.apply(this, arguments);
        }
        return onVerify;
      }()
    }, {
      key: "encrypt",
      value: function () {
        var _encrypt2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee9() {
          var _len9,
            args,
            _key12,
            _args10 = arguments;
          return _regeneratorRuntime().wrap(function _callee9$(_context9) {
            while (1) switch (_context9.prev = _context9.next) {
              case 0:
                for (_len9 = _args10.length, args = new Array(_len9), _key12 = 0; _key12 < _len9; _key12++) {
                  args[_key12] = _args10[_key12];
                }
                this.checkEncrypt.apply(this, args);
                return _context9.abrupt("return", this.onEncrypt.apply(this, args));
              case 3:
              case "end":
                return _context9.stop();
            }
          }, _callee9, this);
        }));
        function encrypt() {
          return _encrypt2.apply(this, arguments);
        }
        return encrypt;
      }()
    }, {
      key: "checkEncrypt",
      value: function checkEncrypt(algorithm, key, _data) {
        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, options.keyUsage ? "encrypt" : void 0);
      }
    }, {
      key: "onEncrypt",
      value: function () {
        var _onEncrypt = _asyncToGenerator(_regeneratorRuntime().mark(function _callee10(_algorithm, _key, _data) {
          return _regeneratorRuntime().wrap(function _callee10$(_context10) {
            while (1) switch (_context10.prev = _context10.next) {
              case 0:
                throw new UnsupportedOperationError("encrypt");
              case 1:
              case "end":
                return _context10.stop();
            }
          }, _callee10);
        }));
        function onEncrypt(_x13, _x14, _x15) {
          return _onEncrypt.apply(this, arguments);
        }
        return onEncrypt;
      }()
    }, {
      key: "decrypt",
      value: function () {
        var _decrypt2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee11() {
          var _len10,
            args,
            _key13,
            _args12 = arguments;
          return _regeneratorRuntime().wrap(function _callee11$(_context11) {
            while (1) switch (_context11.prev = _context11.next) {
              case 0:
                for (_len10 = _args12.length, args = new Array(_len10), _key13 = 0; _key13 < _len10; _key13++) {
                  args[_key13] = _args12[_key13];
                }
                this.checkDecrypt.apply(this, args);
                return _context11.abrupt("return", this.onDecrypt.apply(this, args));
              case 3:
              case "end":
                return _context11.stop();
            }
          }, _callee11, this);
        }));
        function decrypt() {
          return _decrypt2.apply(this, arguments);
        }
        return decrypt;
      }()
    }, {
      key: "checkDecrypt",
      value: function checkDecrypt(algorithm, key, _data) {
        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, options.keyUsage ? "decrypt" : void 0);
      }
    }, {
      key: "onDecrypt",
      value: function () {
        var _onDecrypt = _asyncToGenerator(_regeneratorRuntime().mark(function _callee12(_algorithm, _key, _data) {
          return _regeneratorRuntime().wrap(function _callee12$(_context12) {
            while (1) switch (_context12.prev = _context12.next) {
              case 0:
                throw new UnsupportedOperationError("decrypt");
              case 1:
              case "end":
                return _context12.stop();
            }
          }, _callee12);
        }));
        function onDecrypt(_x16, _x17, _x18) {
          return _onDecrypt.apply(this, arguments);
        }
        return onDecrypt;
      }()
    }, {
      key: "deriveBits",
      value: function () {
        var _deriveBits = _asyncToGenerator(_regeneratorRuntime().mark(function _callee13() {
          var _len11,
            args,
            _key14,
            _args14 = arguments;
          return _regeneratorRuntime().wrap(function _callee13$(_context13) {
            while (1) switch (_context13.prev = _context13.next) {
              case 0:
                for (_len11 = _args14.length, args = new Array(_len11), _key14 = 0; _key14 < _len11; _key14++) {
                  args[_key14] = _args14[_key14];
                }
                this.checkDeriveBits.apply(this, args);
                return _context13.abrupt("return", this.onDeriveBits.apply(this, args));
              case 3:
              case "end":
                return _context13.stop();
            }
          }, _callee13, this);
        }));
        function deriveBits() {
          return _deriveBits.apply(this, arguments);
        }
        return deriveBits;
      }()
    }, {
      key: "checkDeriveBits",
      value: function checkDeriveBits(algorithm, baseKey, length) {
        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(baseKey, options.keyUsage ? "deriveBits" : void 0);
        if (length % 8 !== 0) {
          throw new OperationError("length: Is not multiple of 8");
        }
      }
    }, {
      key: "onDeriveBits",
      value: function () {
        var _onDeriveBits = _asyncToGenerator(_regeneratorRuntime().mark(function _callee14(_algorithm, _baseKey, _length) {
          return _regeneratorRuntime().wrap(function _callee14$(_context14) {
            while (1) switch (_context14.prev = _context14.next) {
              case 0:
                throw new UnsupportedOperationError("deriveBits");
              case 1:
              case "end":
                return _context14.stop();
            }
          }, _callee14);
        }));
        function onDeriveBits(_x19, _x20, _x21) {
          return _onDeriveBits.apply(this, arguments);
        }
        return onDeriveBits;
      }()
    }, {
      key: "exportKey",
      value: function () {
        var _exportKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee15() {
          var _len12,
            args,
            _key15,
            _args16 = arguments;
          return _regeneratorRuntime().wrap(function _callee15$(_context15) {
            while (1) switch (_context15.prev = _context15.next) {
              case 0:
                for (_len12 = _args16.length, args = new Array(_len12), _key15 = 0; _key15 < _len12; _key15++) {
                  args[_key15] = _args16[_key15];
                }
                this.checkExportKey.apply(this, args);
                return _context15.abrupt("return", this.onExportKey.apply(this, args));
              case 3:
              case "end":
                return _context15.stop();
            }
          }, _callee15, this);
        }));
        function exportKey() {
          return _exportKey.apply(this, arguments);
        }
        return exportKey;
      }()
    }, {
      key: "checkExportKey",
      value: function checkExportKey(format, key) {
        this.checkKeyFormat(format);
        this.checkCryptoKey(key);
        if (!key.extractable) {
          throw new CryptoError("key: Is not extractable");
        }
      }
    }, {
      key: "onExportKey",
      value: function () {
        var _onExportKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee16(_format, _key) {
          return _regeneratorRuntime().wrap(function _callee16$(_context16) {
            while (1) switch (_context16.prev = _context16.next) {
              case 0:
                throw new UnsupportedOperationError("exportKey");
              case 1:
              case "end":
                return _context16.stop();
            }
          }, _callee16);
        }));
        function onExportKey(_x22, _x23) {
          return _onExportKey.apply(this, arguments);
        }
        return onExportKey;
      }()
    }, {
      key: "importKey",
      value: function () {
        var _importKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee17() {
          var _len13,
            args,
            _key16,
            _args18 = arguments;
          return _regeneratorRuntime().wrap(function _callee17$(_context17) {
            while (1) switch (_context17.prev = _context17.next) {
              case 0:
                for (_len13 = _args18.length, args = new Array(_len13), _key16 = 0; _key16 < _len13; _key16++) {
                  args[_key16] = _args18[_key16];
                }
                this.checkImportKey.apply(this, args);
                return _context17.abrupt("return", this.onImportKey.apply(this, args));
              case 3:
              case "end":
                return _context17.stop();
            }
          }, _callee17, this);
        }));
        function importKey() {
          return _importKey.apply(this, arguments);
        }
        return importKey;
      }()
    }, {
      key: "checkImportKey",
      value: function checkImportKey(format, keyData, algorithm, _extractable, keyUsages) {
        this.checkKeyFormat(format);
        this.checkKeyData(format, keyData);
        this.checkAlgorithmName(algorithm);
        this.checkImportParams(algorithm);
        if (Array.isArray(this.usages)) {
          this.checkKeyUsages(keyUsages, this.usages);
        }
      }
    }, {
      key: "onImportKey",
      value: function () {
        var _onImportKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee18(_format, _keyData, _algorithm, _extractable, _keyUsages) {
          return _regeneratorRuntime().wrap(function _callee18$(_context18) {
            while (1) switch (_context18.prev = _context18.next) {
              case 0:
                throw new UnsupportedOperationError("importKey");
              case 1:
              case "end":
                return _context18.stop();
            }
          }, _callee18);
        }));
        function onImportKey(_x24, _x25, _x26, _x27, _x28) {
          return _onImportKey.apply(this, arguments);
        }
        return onImportKey;
      }()
    }, {
      key: "checkAlgorithmName",
      value: function checkAlgorithmName(algorithm) {
        if (algorithm.name.toLowerCase() !== this.name.toLowerCase()) {
          throw new AlgorithmError("Unrecognized name");
        }
      }
    }, {
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(_algorithm) {}
    }, {
      key: "checkDerivedKeyParams",
      value: function checkDerivedKeyParams(_algorithm) {}
    }, {
      key: "checkKeyUsages",
      value: function checkKeyUsages(usages, allowed) {
        var _iterator16 = _createForOfIteratorHelper(usages),
          _step16;
        try {
          for (_iterator16.s(); !(_step16 = _iterator16.n()).done;) {
            var usage = _step16.value;
            if (allowed.indexOf(usage) === -1) {
              throw new TypeError("Cannot create a key using the specified key usages");
            }
          }
        } catch (err) {
          _iterator16.e(err);
        } finally {
          _iterator16.f();
        }
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        this.checkAlgorithmName(key.algorithm);
        if (keyUsage && key.usages.indexOf(keyUsage) === -1) {
          throw new CryptoError("key does not match that of operation");
        }
      }
    }, {
      key: "checkRequiredProperty",
      value: function checkRequiredProperty(data, propName) {
        if (!(propName in data)) {
          throw new RequiredPropertyError(propName);
        }
      }
    }, {
      key: "checkHashAlgorithm",
      value: function checkHashAlgorithm(algorithm, hashAlgorithms) {
        var _iterator17 = _createForOfIteratorHelper(hashAlgorithms),
          _step17;
        try {
          for (_iterator17.s(); !(_step17 = _iterator17.n()).done;) {
            var item = _step17.value;
            if (item.toLowerCase() === algorithm.name.toLowerCase()) {
              return;
            }
          }
        } catch (err) {
          _iterator17.e(err);
        } finally {
          _iterator17.f();
        }
        throw new OperationError("hash: Must be one of ".concat(hashAlgorithms.join(", ")));
      }
    }, {
      key: "checkImportParams",
      value: function checkImportParams(_algorithm) {}
    }, {
      key: "checkKeyFormat",
      value: function checkKeyFormat(format) {
        switch (format) {
          case "raw":
          case "pkcs8":
          case "spki":
          case "jwk":
            break;
          default:
            throw new TypeError("format: Is invalid value. Must be 'jwk', 'raw', 'spki', or 'pkcs8'");
        }
      }
    }, {
      key: "checkKeyData",
      value: function checkKeyData(format, keyData) {
        if (!keyData) {
          throw new TypeError("keyData: Cannot be empty on empty on key importing");
        }
        if (format === "jwk") {
          if (!isJWK(keyData)) {
            throw new TypeError("keyData: Is not JsonWebToken");
          }
        } else if (!BufferSourceConverter.isBufferSource(keyData)) {
          throw new TypeError("keyData: Is not ArrayBufferView or ArrayBuffer");
        }
      }
    }, {
      key: "prepareData",
      value: function prepareData(data) {
        return BufferSourceConverter.toArrayBuffer(data);
      }
    }]);
    return ProviderCrypto;
  }();
  var AesProvider = function (_ProviderCrypto) {
    _inherits(AesProvider, _ProviderCrypto);
    function AesProvider() {
      _classCallCheck(this, AesProvider);
      return _callSuper(this, AesProvider, arguments);
    }
    _createClass(AesProvider, [{
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
          throw new TypeError("length: Is not of type Number");
        }
        switch (algorithm.length) {
          case 128:
          case 192:
          case 256:
            break;
          default:
            throw new TypeError("length: Must be 128, 192, or 256");
        }
      }
    }, {
      key: "checkDerivedKeyParams",
      value: function checkDerivedKeyParams(algorithm) {
        this.checkGenerateKeyParams(algorithm);
      }
    }]);
    return AesProvider;
  }(ProviderCrypto);
  var AesCbcProvider$1 = function (_AesProvider) {
    _inherits(AesCbcProvider, _AesProvider);
    function AesCbcProvider() {
      var _this62;
      _classCallCheck(this, AesCbcProvider);
      _this62 = _callSuper(this, AesCbcProvider, arguments);
      _this62.name = "AES-CBC";
      _this62.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
      return _this62;
    }
    _createClass(AesCbcProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "iv");
        if (!(algorithm.iv instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.iv))) {
          throw new TypeError("iv: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        if (algorithm.iv.byteLength !== 16) {
          throw new TypeError("iv: Must have length 16 bytes");
        }
      }
    }]);
    return AesCbcProvider;
  }(AesProvider);
  var AesCtrProvider$1 = function (_AesProvider2) {
    _inherits(AesCtrProvider, _AesProvider2);
    function AesCtrProvider() {
      var _this63;
      _classCallCheck(this, AesCtrProvider);
      _this63 = _callSuper(this, AesCtrProvider, arguments);
      _this63.name = "AES-CTR";
      _this63.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
      return _this63;
    }
    _createClass(AesCtrProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "counter");
        if (!(algorithm.counter instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.counter))) {
          throw new TypeError("counter: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        if (algorithm.counter.byteLength !== 16) {
          throw new TypeError("iv: Must have length 16 bytes");
        }
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
          throw new TypeError("length: Is not a Number");
        }
        if (algorithm.length < 1) {
          throw new OperationError("length: Must be more than 0");
        }
      }
    }]);
    return AesCtrProvider;
  }(AesProvider);
  var AesEcbProvider$1 = function (_AesProvider3) {
    _inherits(AesEcbProvider, _AesProvider3);
    function AesEcbProvider() {
      var _this64;
      _classCallCheck(this, AesEcbProvider);
      _this64 = _callSuper(this, AesEcbProvider, arguments);
      _this64.name = "AES-ECB";
      _this64.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
      return _this64;
    }
    return _createClass(AesEcbProvider);
  }(AesProvider);
  var AesGcmProvider$1 = function (_AesProvider4) {
    _inherits(AesGcmProvider, _AesProvider4);
    function AesGcmProvider() {
      var _this65;
      _classCallCheck(this, AesGcmProvider);
      _this65 = _callSuper(this, AesGcmProvider, arguments);
      _this65.name = "AES-GCM";
      _this65.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
      return _this65;
    }
    _createClass(AesGcmProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "iv");
        if (!(algorithm.iv instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.iv))) {
          throw new TypeError("iv: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        if (algorithm.iv.byteLength < 1) {
          throw new OperationError("iv: Must have length more than 0 and less than 2^64 - 1");
        }
        if (!("tagLength" in algorithm)) {
          algorithm.tagLength = 128;
        }
        switch (algorithm.tagLength) {
          case 32:
          case 64:
          case 96:
          case 104:
          case 112:
          case 120:
          case 128:
            break;
          default:
            throw new OperationError("tagLength: Must be one of 32, 64, 96, 104, 112, 120 or 128");
        }
      }
    }]);
    return AesGcmProvider;
  }(AesProvider);
  var AesKwProvider$1 = function (_AesProvider5) {
    _inherits(AesKwProvider, _AesProvider5);
    function AesKwProvider() {
      var _this66;
      _classCallCheck(this, AesKwProvider);
      _this66 = _callSuper(this, AesKwProvider, arguments);
      _this66.name = "AES-KW";
      _this66.usages = ["wrapKey", "unwrapKey"];
      return _this66;
    }
    return _createClass(AesKwProvider);
  }(AesProvider);
  var DesProvider = function (_ProviderCrypto2) {
    _inherits(DesProvider, _ProviderCrypto2);
    function DesProvider() {
      var _this67;
      _classCallCheck(this, DesProvider);
      _this67 = _callSuper(this, DesProvider, arguments);
      _this67.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
      return _this67;
    }
    _createClass(DesProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        if (this.ivSize) {
          this.checkRequiredProperty(algorithm, "iv");
          if (!(algorithm.iv instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.iv))) {
            throw new TypeError("iv: Is not of type '(ArrayBuffer or ArrayBufferView)'");
          }
          if (algorithm.iv.byteLength !== this.ivSize) {
            throw new TypeError("iv: Must have length ".concat(this.ivSize, " bytes"));
          }
        }
      }
    }, {
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
          throw new TypeError("length: Is not of type Number");
        }
        if (algorithm.length !== this.keySizeBits) {
          throw new OperationError("algorithm.length: Must be ".concat(this.keySizeBits));
        }
      }
    }, {
      key: "checkDerivedKeyParams",
      value: function checkDerivedKeyParams(algorithm) {
        this.checkGenerateKeyParams(algorithm);
      }
    }]);
    return DesProvider;
  }(ProviderCrypto);
  var RsaProvider = function (_ProviderCrypto3) {
    _inherits(RsaProvider, _ProviderCrypto3);
    function RsaProvider() {
      var _this68;
      _classCallCheck(this, RsaProvider);
      _this68 = _callSuper(this, RsaProvider, arguments);
      _this68.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
      return _this68;
    }
    _createClass(RsaProvider, [{
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        this.checkRequiredProperty(algorithm, "publicExponent");
        if (!(algorithm.publicExponent && algorithm.publicExponent instanceof Uint8Array)) {
          throw new TypeError("publicExponent: Missing or not a Uint8Array");
        }
        var publicExponent = Convert.ToBase64(algorithm.publicExponent);
        if (!(publicExponent === "Aw==" || publicExponent === "AQAB")) {
          throw new TypeError("publicExponent: Must be [3] or [1,0,1]");
        }
        this.checkRequiredProperty(algorithm, "modulusLength");
        if (algorithm.modulusLength % 8 || algorithm.modulusLength < 256 || algorithm.modulusLength > 16384) {
          throw new TypeError("The modulus length must be a multiple of 8 bits and >= 256 and <= 16384");
        }
      }
    }, {
      key: "checkImportParams",
      value: function checkImportParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
      }
    }]);
    return RsaProvider;
  }(ProviderCrypto);
  var RsaSsaProvider$1 = function (_RsaProvider) {
    _inherits(RsaSsaProvider, _RsaProvider);
    function RsaSsaProvider() {
      var _this69;
      _classCallCheck(this, RsaSsaProvider);
      _this69 = _callSuper(this, RsaSsaProvider, arguments);
      _this69.name = "RSASSA-PKCS1-v1_5";
      _this69.usages = {
        privateKey: ["sign"],
        publicKey: ["verify"]
      };
      return _this69;
    }
    return _createClass(RsaSsaProvider);
  }(RsaProvider);
  var RsaPssProvider$1 = function (_RsaProvider2) {
    _inherits(RsaPssProvider, _RsaProvider2);
    function RsaPssProvider() {
      var _this70;
      _classCallCheck(this, RsaPssProvider);
      _this70 = _callSuper(this, RsaPssProvider, arguments);
      _this70.name = "RSA-PSS";
      _this70.usages = {
        privateKey: ["sign"],
        publicKey: ["verify"]
      };
      return _this70;
    }
    _createClass(RsaPssProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "saltLength");
        if (typeof algorithm.saltLength !== "number") {
          throw new TypeError("saltLength: Is not a Number");
        }
        if (algorithm.saltLength < 0) {
          throw new RangeError("saltLength: Must be positive number");
        }
      }
    }]);
    return RsaPssProvider;
  }(RsaProvider);
  var RsaOaepProvider$1 = function (_RsaProvider3) {
    _inherits(RsaOaepProvider, _RsaProvider3);
    function RsaOaepProvider() {
      var _this71;
      _classCallCheck(this, RsaOaepProvider);
      _this71 = _callSuper(this, RsaOaepProvider, arguments);
      _this71.name = "RSA-OAEP";
      _this71.usages = {
        privateKey: ["decrypt", "unwrapKey"],
        publicKey: ["encrypt", "wrapKey"]
      };
      return _this71;
    }
    _createClass(RsaOaepProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        if (algorithm.label && !(algorithm.label instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.label))) {
          throw new TypeError("label: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
      }
    }]);
    return RsaOaepProvider;
  }(RsaProvider);
  var EllipticProvider = function (_ProviderCrypto4) {
    _inherits(EllipticProvider, _ProviderCrypto4);
    function EllipticProvider() {
      _classCallCheck(this, EllipticProvider);
      return _callSuper(this, EllipticProvider, arguments);
    }
    _createClass(EllipticProvider, [{
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "namedCurve");
        this.checkNamedCurve(algorithm.namedCurve);
      }
    }, {
      key: "checkNamedCurve",
      value: function checkNamedCurve(namedCurve) {
        var _iterator18 = _createForOfIteratorHelper(this.namedCurves),
          _step18;
        try {
          for (_iterator18.s(); !(_step18 = _iterator18.n()).done;) {
            var item = _step18.value;
            if (item.toLowerCase() === namedCurve.toLowerCase()) {
              return;
            }
          }
        } catch (err) {
          _iterator18.e(err);
        } finally {
          _iterator18.f();
        }
        throw new OperationError("namedCurve: Must be one of ".concat(this.namedCurves.join(", ")));
      }
    }]);
    return EllipticProvider;
  }(ProviderCrypto);
  var EcdsaProvider$1 = function (_EllipticProvider) {
    _inherits(EcdsaProvider, _EllipticProvider);
    function EcdsaProvider() {
      var _this72;
      _classCallCheck(this, EcdsaProvider);
      _this72 = _callSuper(this, EcdsaProvider, arguments);
      _this72.name = "ECDSA";
      _this72.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
      _this72.usages = {
        privateKey: ["sign"],
        publicKey: ["verify"]
      };
      _this72.namedCurves = ["P-256", "P-384", "P-521", "K-256"];
      return _this72;
    }
    _createClass(EcdsaProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
      }
    }]);
    return EcdsaProvider;
  }(EllipticProvider);
  var KEY_TYPES = ["secret", "private", "public"];
  var CryptoKey$1 = function (_Symbol$toStringTag) {
    function CryptoKey() {
      _classCallCheck(this, CryptoKey);
    }
    _createClass(CryptoKey, [{
      key: _Symbol$toStringTag,
      get: function get() {
        return "CryptoKey";
      }
    }], [{
      key: "create",
      value: function create(algorithm, type, extractable, usages) {
        var key = new this();
        key.algorithm = algorithm;
        key.type = type;
        key.extractable = extractable;
        key.usages = usages;
        return key;
      }
    }, {
      key: "isKeyType",
      value: function isKeyType(data) {
        return KEY_TYPES.indexOf(data) !== -1;
      }
    }]);
    return CryptoKey;
  }(Symbol.toStringTag);
  var EcdhProvider$1 = function (_EllipticProvider2) {
    _inherits(EcdhProvider, _EllipticProvider2);
    function EcdhProvider() {
      var _this73;
      _classCallCheck(this, EcdhProvider);
      _this73 = _callSuper(this, EcdhProvider, arguments);
      _this73.name = "ECDH";
      _this73.usages = {
        privateKey: ["deriveBits", "deriveKey"],
        publicKey: []
      };
      _this73.namedCurves = ["P-256", "P-384", "P-521", "K-256"];
      return _this73;
    }
    _createClass(EcdhProvider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "public");
        if (!(algorithm.public instanceof CryptoKey$1)) {
          throw new TypeError("public: Is not a CryptoKey");
        }
        if (algorithm.public.type !== "public") {
          throw new OperationError("public: Is not a public key");
        }
        if (algorithm.public.algorithm.name !== this.name) {
          throw new OperationError("public: Is not ".concat(this.name, " key"));
        }
      }
    }]);
    return EcdhProvider;
  }(EllipticProvider);
  var EcdhEsProvider$1 = function (_EcdhProvider$) {
    _inherits(EcdhEsProvider, _EcdhProvider$);
    function EcdhEsProvider() {
      var _this74;
      _classCallCheck(this, EcdhEsProvider);
      _this74 = _callSuper(this, EcdhEsProvider, arguments);
      _this74.name = "ECDH-ES";
      _this74.namedCurves = ["X25519", "X448"];
      return _this74;
    }
    return _createClass(EcdhEsProvider);
  }(EcdhProvider$1);
  var EdDsaProvider$1 = function (_EllipticProvider3) {
    _inherits(EdDsaProvider, _EllipticProvider3);
    function EdDsaProvider() {
      var _this75;
      _classCallCheck(this, EdDsaProvider);
      _this75 = _callSuper(this, EdDsaProvider, arguments);
      _this75.name = "EdDSA";
      _this75.usages = {
        privateKey: ["sign"],
        publicKey: ["verify"]
      };
      _this75.namedCurves = ["Ed25519", "Ed448"];
      return _this75;
    }
    return _createClass(EdDsaProvider);
  }(EllipticProvider);
  var ObjectIdentifier = _createClass(function ObjectIdentifier(value) {
    _classCallCheck(this, ObjectIdentifier);
    if (value) {
      this.value = value;
    }
  });
  __decorate([AsnProp({
    type: AsnPropTypes.ObjectIdentifier
  })], ObjectIdentifier.prototype, "value", void 0);
  ObjectIdentifier = __decorate([AsnType({
    type: AsnTypeTypes.Choice
  })], ObjectIdentifier);
  var AlgorithmIdentifier = _createClass(function AlgorithmIdentifier(params) {
    _classCallCheck(this, AlgorithmIdentifier);
    Object.assign(this, params);
  });
  __decorate([AsnProp({
    type: AsnPropTypes.ObjectIdentifier
  })], AlgorithmIdentifier.prototype, "algorithm", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Any,
    optional: true
  })], AlgorithmIdentifier.prototype, "parameters", void 0);
  var PrivateKeyInfo = _createClass(function PrivateKeyInfo() {
    _classCallCheck(this, PrivateKeyInfo);
    this.version = 0;
    this.privateKeyAlgorithm = new AlgorithmIdentifier();
    this.privateKey = new ArrayBuffer(0);
  });
  __decorate([AsnProp({
    type: AsnPropTypes.Integer
  })], PrivateKeyInfo.prototype, "version", void 0);
  __decorate([AsnProp({
    type: AlgorithmIdentifier
  })], PrivateKeyInfo.prototype, "privateKeyAlgorithm", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.OctetString
  })], PrivateKeyInfo.prototype, "privateKey", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Any,
    optional: true
  })], PrivateKeyInfo.prototype, "attributes", void 0);
  var PublicKeyInfo = _createClass(function PublicKeyInfo() {
    _classCallCheck(this, PublicKeyInfo);
    this.publicKeyAlgorithm = new AlgorithmIdentifier();
    this.publicKey = new ArrayBuffer(0);
  });
  __decorate([AsnProp({
    type: AlgorithmIdentifier
  })], PublicKeyInfo.prototype, "publicKeyAlgorithm", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.BitString
  })], PublicKeyInfo.prototype, "publicKey", void 0);
  var JsonBase64UrlArrayBufferConverter = {
    fromJSON: function fromJSON(value) {
      return Convert.FromBase64Url(value);
    },
    toJSON: function toJSON(value) {
      return Convert.ToBase64Url(new Uint8Array(value));
    }
  };
  var AsnIntegerArrayBufferConverter = {
    fromASN: function fromASN(value) {
      var valueHex = value.valueBlock.valueHex;
      return !new Uint8Array(valueHex)[0] ? value.valueBlock.valueHex.slice(1) : value.valueBlock.valueHex;
    },
    toASN: function toASN(value) {
      var valueHex = new Uint8Array(value)[0] > 127 ? combine(new Uint8Array([0]).buffer, value) : value;
      return new Integer({
        valueHex: valueHex
      });
    }
  };
  var RsaPrivateKey = _createClass(function RsaPrivateKey() {
    _classCallCheck(this, RsaPrivateKey);
    this.version = 0;
    this.modulus = new ArrayBuffer(0);
    this.publicExponent = new ArrayBuffer(0);
    this.privateExponent = new ArrayBuffer(0);
    this.prime1 = new ArrayBuffer(0);
    this.prime2 = new ArrayBuffer(0);
    this.exponent1 = new ArrayBuffer(0);
    this.exponent2 = new ArrayBuffer(0);
    this.coefficient = new ArrayBuffer(0);
  });
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerConverter
  })], RsaPrivateKey.prototype, "version", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "n",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "modulus", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "e",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "publicExponent", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "d",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "privateExponent", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "p",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "prime1", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "q",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "prime2", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "dp",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "exponent1", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "dq",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "exponent2", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "qi",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPrivateKey.prototype, "coefficient", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Any,
    optional: true
  })], RsaPrivateKey.prototype, "otherPrimeInfos", void 0);
  var RsaPublicKey = _createClass(function RsaPublicKey() {
    _classCallCheck(this, RsaPublicKey);
    this.modulus = new ArrayBuffer(0);
    this.publicExponent = new ArrayBuffer(0);
  });
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "n",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPublicKey.prototype, "modulus", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerArrayBufferConverter
  }), JsonProp({
    name: "e",
    converter: JsonBase64UrlArrayBufferConverter
  })], RsaPublicKey.prototype, "publicExponent", void 0);
  var EcPublicKey = function () {
    function EcPublicKey(value) {
      _classCallCheck(this, EcPublicKey);
      this.value = new ArrayBuffer(0);
      if (value) {
        this.value = value;
      }
    }
    _createClass(EcPublicKey, [{
      key: "toJSON",
      value: function toJSON() {
        var bytes = new Uint8Array(this.value);
        if (bytes[0] !== 0x04) {
          throw new CryptoError("Wrong ECPoint. Current version supports only Uncompressed (0x04) point");
        }
        bytes = new Uint8Array(this.value.slice(1));
        var size = bytes.length / 2;
        var offset = 0;
        var json = {
          x: Convert.ToBase64Url(bytes.buffer.slice(offset, offset + size)),
          y: Convert.ToBase64Url(bytes.buffer.slice(offset + size, offset + size + size))
        };
        return json;
      }
    }, {
      key: "fromJSON",
      value: function fromJSON(json) {
        if (!("x" in json)) {
          throw new Error("x: Missing required property");
        }
        if (!("y" in json)) {
          throw new Error("y: Missing required property");
        }
        var x = Convert.FromBase64Url(json.x);
        var y = Convert.FromBase64Url(json.y);
        var value = combine(new Uint8Array([0x04]).buffer, x, y);
        this.value = new Uint8Array(value).buffer;
        return this;
      }
    }]);
    return EcPublicKey;
  }();
  __decorate([AsnProp({
    type: AsnPropTypes.OctetString
  })], EcPublicKey.prototype, "value", void 0);
  EcPublicKey = __decorate([AsnType({
    type: AsnTypeTypes.Choice
  })], EcPublicKey);
  var EcPrivateKey = function () {
    function EcPrivateKey() {
      _classCallCheck(this, EcPrivateKey);
      this.version = 1;
      this.privateKey = new ArrayBuffer(0);
    }
    _createClass(EcPrivateKey, [{
      key: "fromJSON",
      value: function fromJSON(json) {
        if (!("d" in json)) {
          throw new Error("d: Missing required property");
        }
        this.privateKey = Convert.FromBase64Url(json.d);
        if ("x" in json) {
          var publicKey = new EcPublicKey();
          publicKey.fromJSON(json);
          var asn = AsnSerializer.toASN(publicKey);
          if ("valueHex" in asn.valueBlock) {
            this.publicKey = asn.valueBlock.valueHex;
          }
        }
        return this;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        var jwk = {};
        jwk.d = Convert.ToBase64Url(this.privateKey);
        if (this.publicKey) {
          Object.assign(jwk, new EcPublicKey(this.publicKey).toJSON());
        }
        return jwk;
      }
    }]);
    return EcPrivateKey;
  }();
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerConverter
  })], EcPrivateKey.prototype, "version", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.OctetString
  })], EcPrivateKey.prototype, "privateKey", void 0);
  __decorate([AsnProp({
    context: 0,
    type: AsnPropTypes.Any,
    optional: true
  })], EcPrivateKey.prototype, "parameters", void 0);
  __decorate([AsnProp({
    context: 1,
    type: AsnPropTypes.BitString,
    optional: true
  })], EcPrivateKey.prototype, "publicKey", void 0);
  var AsnIntegerWithoutPaddingConverter = {
    fromASN: function fromASN(value) {
      var bytes = new Uint8Array(value.valueBlock.valueHex);
      return bytes[0] === 0 ? bytes.buffer.slice(1) : bytes.buffer;
    },
    toASN: function toASN(value) {
      var bytes = new Uint8Array(value);
      if (bytes[0] > 127) {
        var newValue = new Uint8Array(bytes.length + 1);
        newValue.set(bytes, 1);
        return new Integer({
          valueHex: newValue.buffer
        });
      }
      return new Integer({
        valueHex: value
      });
    }
  };
  var index$2 = Object.freeze({
    __proto__: null,
    AsnIntegerWithoutPaddingConverter: AsnIntegerWithoutPaddingConverter
  });
  var EcUtils = function () {
    function EcUtils() {
      _classCallCheck(this, EcUtils);
    }
    _createClass(EcUtils, null, [{
      key: "decodePoint",
      value: function decodePoint(data, pointSize) {
        var view = BufferSourceConverter.toUint8Array(data);
        if (view.length === 0 || view[0] !== 4) {
          throw new Error("Only uncompressed point format supported");
        }
        var n = (view.length - 1) / 2;
        if (n !== Math.ceil(pointSize / 8)) {
          throw new Error("Point does not match field size");
        }
        var xb = view.slice(1, n + 1);
        var yb = view.slice(n + 1, n + 1 + n);
        return {
          x: xb,
          y: yb
        };
      }
    }, {
      key: "encodePoint",
      value: function encodePoint(point, pointSize) {
        var size = Math.ceil(pointSize / 8);
        if (point.x.byteLength !== size || point.y.byteLength !== size) {
          throw new Error("X,Y coordinates don't match point size criteria");
        }
        var x = BufferSourceConverter.toUint8Array(point.x);
        var y = BufferSourceConverter.toUint8Array(point.y);
        var res = new Uint8Array(size * 2 + 1);
        res[0] = 4;
        res.set(x, 1);
        res.set(y, size + 1);
        return res;
      }
    }, {
      key: "getSize",
      value: function getSize(pointSize) {
        return Math.ceil(pointSize / 8);
      }
    }, {
      key: "encodeSignature",
      value: function encodeSignature(signature, pointSize) {
        var size = this.getSize(pointSize);
        var r = BufferSourceConverter.toUint8Array(signature.r);
        var s = BufferSourceConverter.toUint8Array(signature.s);
        var res = new Uint8Array(size * 2);
        res.set(this.padStart(r, size));
        res.set(this.padStart(s, size), size);
        return res;
      }
    }, {
      key: "decodeSignature",
      value: function decodeSignature(data, pointSize) {
        var size = this.getSize(pointSize);
        var view = BufferSourceConverter.toUint8Array(data);
        if (view.length !== size * 2) {
          throw new Error("Incorrect size of the signature");
        }
        var r = view.slice(0, size);
        var s = view.slice(size);
        return {
          r: this.trimStart(r),
          s: this.trimStart(s)
        };
      }
    }, {
      key: "trimStart",
      value: function trimStart(data) {
        var i = 0;
        while (i < data.length - 1 && data[i] === 0) {
          i++;
        }
        if (i === 0) {
          return data;
        }
        return data.slice(i, data.length);
      }
    }, {
      key: "padStart",
      value: function padStart(data, size) {
        if (size === data.length) {
          return data;
        }
        var res = new Uint8Array(size);
        res.set(data, size - data.length);
        return res;
      }
    }]);
    return EcUtils;
  }();
  var EcDsaSignature = function () {
    function EcDsaSignature() {
      _classCallCheck(this, EcDsaSignature);
      this.r = new ArrayBuffer(0);
      this.s = new ArrayBuffer(0);
    }
    _createClass(EcDsaSignature, [{
      key: "toWebCryptoSignature",
      value: function toWebCryptoSignature(pointSize) {
        pointSize !== null && pointSize !== void 0 ? pointSize : pointSize = Math.max(this.r.byteLength, this.s.byteLength) * 8;
        var signature = EcUtils.encodeSignature(this, pointSize);
        return signature.buffer;
      }
    }], [{
      key: "fromWebCryptoSignature",
      value: function fromWebCryptoSignature(value) {
        var pointSize = value.byteLength / 2;
        var point = EcUtils.decodeSignature(value, pointSize * 8);
        var ecSignature = new EcDsaSignature();
        ecSignature.r = BufferSourceConverter.toArrayBuffer(point.r);
        ecSignature.s = BufferSourceConverter.toArrayBuffer(point.s);
        return ecSignature;
      }
    }]);
    return EcDsaSignature;
  }();
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerWithoutPaddingConverter
  })], EcDsaSignature.prototype, "r", void 0);
  __decorate([AsnProp({
    type: AsnPropTypes.Integer,
    converter: AsnIntegerWithoutPaddingConverter
  })], EcDsaSignature.prototype, "s", void 0);
  var OneAsymmetricKey = function (_PrivateKeyInfo) {
    _inherits(OneAsymmetricKey, _PrivateKeyInfo);
    function OneAsymmetricKey() {
      _classCallCheck(this, OneAsymmetricKey);
      return _callSuper(this, OneAsymmetricKey, arguments);
    }
    return _createClass(OneAsymmetricKey);
  }(PrivateKeyInfo);
  __decorate([AsnProp({
    context: 1,
    implicit: true,
    type: AsnPropTypes.BitString,
    optional: true
  })], OneAsymmetricKey.prototype, "publicKey", void 0);
  var EdPrivateKey$1 = function () {
    function EdPrivateKey() {
      _classCallCheck(this, EdPrivateKey);
      this.value = new ArrayBuffer(0);
    }
    _createClass(EdPrivateKey, [{
      key: "fromJSON",
      value: function fromJSON(json) {
        if (!json.d) {
          throw new Error("d: Missing required property");
        }
        this.value = Convert.FromBase64Url(json.d);
        return this;
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        var jwk = {
          d: Convert.ToBase64Url(this.value)
        };
        return jwk;
      }
    }]);
    return EdPrivateKey;
  }();
  __decorate([AsnProp({
    type: AsnPropTypes.OctetString
  })], EdPrivateKey$1.prototype, "value", void 0);
  EdPrivateKey$1 = __decorate([AsnType({
    type: AsnTypeTypes.Choice
  })], EdPrivateKey$1);
  var EdPublicKey$1 = function () {
    function EdPublicKey(value) {
      _classCallCheck(this, EdPublicKey);
      this.value = new ArrayBuffer(0);
      if (value) {
        this.value = value;
      }
    }
    _createClass(EdPublicKey, [{
      key: "toJSON",
      value: function toJSON() {
        var json = {
          x: Convert.ToBase64Url(this.value)
        };
        return json;
      }
    }, {
      key: "fromJSON",
      value: function fromJSON(json) {
        if (!("x" in json)) {
          throw new Error("x: Missing required property");
        }
        this.value = Convert.FromBase64Url(json.x);
        return this;
      }
    }]);
    return EdPublicKey;
  }();
  __decorate([AsnProp({
    type: AsnPropTypes.BitString
  })], EdPublicKey$1.prototype, "value", void 0);
  EdPublicKey$1 = __decorate([AsnType({
    type: AsnTypeTypes.Choice
  })], EdPublicKey$1);
  var CurvePrivateKey = _createClass(function CurvePrivateKey() {
    _classCallCheck(this, CurvePrivateKey);
  });
  __decorate([AsnProp({
    type: AsnPropTypes.OctetString
  }), JsonProp({
    type: JsonPropTypes.String,
    converter: JsonBase64UrlArrayBufferConverter
  })], CurvePrivateKey.prototype, "d", void 0);
  CurvePrivateKey = __decorate([AsnType({
    type: AsnTypeTypes.Choice
  })], CurvePrivateKey);
  var idSecp256r1 = "1.2.840.10045.3.1.7";
  var idEllipticCurve = "1.3.132.0";
  var idSecp384r1 = "".concat(idEllipticCurve, ".34");
  var idSecp521r1 = "".concat(idEllipticCurve, ".35");
  var idSecp256k1 = "".concat(idEllipticCurve, ".10");
  var idVersionOne = "1.3.36.3.3.2.8.1.1";
  var idBrainpoolP160r1 = "".concat(idVersionOne, ".1");
  var idBrainpoolP160t1 = "".concat(idVersionOne, ".2");
  var idBrainpoolP192r1 = "".concat(idVersionOne, ".3");
  var idBrainpoolP192t1 = "".concat(idVersionOne, ".4");
  var idBrainpoolP224r1 = "".concat(idVersionOne, ".5");
  var idBrainpoolP224t1 = "".concat(idVersionOne, ".6");
  var idBrainpoolP256r1 = "".concat(idVersionOne, ".7");
  var idBrainpoolP256t1 = "".concat(idVersionOne, ".8");
  var idBrainpoolP320r1 = "".concat(idVersionOne, ".9");
  var idBrainpoolP320t1 = "".concat(idVersionOne, ".10");
  var idBrainpoolP384r1 = "".concat(idVersionOne, ".11");
  var idBrainpoolP384t1 = "".concat(idVersionOne, ".12");
  var idBrainpoolP512r1 = "".concat(idVersionOne, ".13");
  var idBrainpoolP512t1 = "".concat(idVersionOne, ".14");
  var idX25519 = "1.3.101.110";
  var idX448 = "1.3.101.111";
  var idEd25519 = "1.3.101.112";
  var idEd448 = "1.3.101.113";
  var index$1 = Object.freeze({
    __proto__: null,
    AlgorithmIdentifier: AlgorithmIdentifier,
    get CurvePrivateKey() {
      return CurvePrivateKey;
    },
    EcDsaSignature: EcDsaSignature,
    EcPrivateKey: EcPrivateKey,
    get EcPublicKey() {
      return EcPublicKey;
    },
    get EdPrivateKey() {
      return EdPrivateKey$1;
    },
    get EdPublicKey() {
      return EdPublicKey$1;
    },
    get ObjectIdentifier() {
      return ObjectIdentifier;
    },
    OneAsymmetricKey: OneAsymmetricKey,
    PrivateKeyInfo: PrivateKeyInfo,
    PublicKeyInfo: PublicKeyInfo,
    RsaPrivateKey: RsaPrivateKey,
    RsaPublicKey: RsaPublicKey,
    converters: index$2,
    idBrainpoolP160r1: idBrainpoolP160r1,
    idBrainpoolP160t1: idBrainpoolP160t1,
    idBrainpoolP192r1: idBrainpoolP192r1,
    idBrainpoolP192t1: idBrainpoolP192t1,
    idBrainpoolP224r1: idBrainpoolP224r1,
    idBrainpoolP224t1: idBrainpoolP224t1,
    idBrainpoolP256r1: idBrainpoolP256r1,
    idBrainpoolP256t1: idBrainpoolP256t1,
    idBrainpoolP320r1: idBrainpoolP320r1,
    idBrainpoolP320t1: idBrainpoolP320t1,
    idBrainpoolP384r1: idBrainpoolP384r1,
    idBrainpoolP384t1: idBrainpoolP384t1,
    idBrainpoolP512r1: idBrainpoolP512r1,
    idBrainpoolP512t1: idBrainpoolP512t1,
    idEd25519: idEd25519,
    idEd448: idEd448,
    idEllipticCurve: idEllipticCurve,
    idSecp256k1: idSecp256k1,
    idSecp256r1: idSecp256r1,
    idSecp384r1: idSecp384r1,
    idSecp521r1: idSecp521r1,
    idVersionOne: idVersionOne,
    idX25519: idX25519,
    idX448: idX448
  });
  var EcCurves = function () {
    function EcCurves() {
      _classCallCheck(this, EcCurves);
    }
    _createClass(EcCurves, null, [{
      key: "register",
      value: function register(item) {
        var oid = new ObjectIdentifier();
        oid.value = item.id;
        var raw = AsnConvert.serialize(oid);
        this.items.push(_objectSpread(_objectSpread({}, item), {}, {
          raw: raw
        }));
        this.names.push(item.name);
      }
    }, {
      key: "find",
      value: function find(nameOrId) {
        nameOrId = nameOrId.toUpperCase();
        var _iterator19 = _createForOfIteratorHelper(this.items),
          _step19;
        try {
          for (_iterator19.s(); !(_step19 = _iterator19.n()).done;) {
            var item = _step19.value;
            if (item.name.toUpperCase() === nameOrId || item.id.toUpperCase() === nameOrId) {
              return item;
            }
          }
        } catch (err) {
          _iterator19.e(err);
        } finally {
          _iterator19.f();
        }
        return null;
      }
    }, {
      key: "get",
      value: function get(nameOrId) {
        var res = this.find(nameOrId);
        if (!res) {
          throw new Error("Unsupported EC named curve '".concat(nameOrId, "'"));
        }
        return res;
      }
    }]);
    return EcCurves;
  }();
  EcCurves.items = [];
  EcCurves.names = [];
  EcCurves.register({
    name: "P-256",
    id: idSecp256r1,
    size: 256
  });
  EcCurves.register({
    name: "P-384",
    id: idSecp384r1,
    size: 384
  });
  EcCurves.register({
    name: "P-521",
    id: idSecp521r1,
    size: 521
  });
  EcCurves.register({
    name: "K-256",
    id: idSecp256k1,
    size: 256
  });
  EcCurves.register({
    name: "brainpoolP160r1",
    id: idBrainpoolP160r1,
    size: 160
  });
  EcCurves.register({
    name: "brainpoolP160t1",
    id: idBrainpoolP160t1,
    size: 160
  });
  EcCurves.register({
    name: "brainpoolP192r1",
    id: idBrainpoolP192r1,
    size: 192
  });
  EcCurves.register({
    name: "brainpoolP192t1",
    id: idBrainpoolP192t1,
    size: 192
  });
  EcCurves.register({
    name: "brainpoolP224r1",
    id: idBrainpoolP224r1,
    size: 224
  });
  EcCurves.register({
    name: "brainpoolP224t1",
    id: idBrainpoolP224t1,
    size: 224
  });
  EcCurves.register({
    name: "brainpoolP256r1",
    id: idBrainpoolP256r1,
    size: 256
  });
  EcCurves.register({
    name: "brainpoolP256t1",
    id: idBrainpoolP256t1,
    size: 256
  });
  EcCurves.register({
    name: "brainpoolP320r1",
    id: idBrainpoolP320r1,
    size: 320
  });
  EcCurves.register({
    name: "brainpoolP320t1",
    id: idBrainpoolP320t1,
    size: 320
  });
  EcCurves.register({
    name: "brainpoolP384r1",
    id: idBrainpoolP384r1,
    size: 384
  });
  EcCurves.register({
    name: "brainpoolP384t1",
    id: idBrainpoolP384t1,
    size: 384
  });
  EcCurves.register({
    name: "brainpoolP512r1",
    id: idBrainpoolP512r1,
    size: 512
  });
  EcCurves.register({
    name: "brainpoolP512t1",
    id: idBrainpoolP512t1,
    size: 512
  });
  var HmacProvider$1 = function (_ProviderCrypto5) {
    _inherits(HmacProvider, _ProviderCrypto5);
    function HmacProvider() {
      var _this76;
      _classCallCheck(this, HmacProvider);
      _this76 = _callSuper(this, HmacProvider, arguments);
      _this76.name = "HMAC";
      _this76.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
      _this76.usages = ["sign", "verify"];
      return _this76;
    }
    _createClass(HmacProvider, [{
      key: "getDefaultLength",
      value: function getDefaultLength(algName) {
        switch (algName.toUpperCase()) {
          case "SHA-1":
          case "SHA-256":
          case "SHA-384":
          case "SHA-512":
            return 512;
          default:
            throw new Error("Unknown algorithm name '".concat(algName, "'"));
        }
      }
    }, {
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        if ("length" in algorithm) {
          if (typeof algorithm.length !== "number") {
            throw new TypeError("length: Is not a Number");
          }
          if (algorithm.length < 1) {
            throw new RangeError("length: Number is out of range");
          }
        }
      }
    }, {
      key: "checkImportParams",
      value: function checkImportParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
      }
    }]);
    return HmacProvider;
  }(ProviderCrypto);
  var Pbkdf2Provider$1 = function (_ProviderCrypto6) {
    _inherits(Pbkdf2Provider, _ProviderCrypto6);
    function Pbkdf2Provider() {
      var _this77;
      _classCallCheck(this, Pbkdf2Provider);
      _this77 = _callSuper(this, Pbkdf2Provider, arguments);
      _this77.name = "PBKDF2";
      _this77.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
      _this77.usages = ["deriveBits", "deriveKey"];
      return _this77;
    }
    _createClass(Pbkdf2Provider, [{
      key: "checkAlgorithmParams",
      value: function checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        this.checkRequiredProperty(algorithm, "salt");
        if (!(algorithm.salt instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.salt))) {
          throw new TypeError("salt: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        this.checkRequiredProperty(algorithm, "iterations");
        if (typeof algorithm.iterations !== "number") {
          throw new TypeError("iterations: Is not a Number");
        }
        if (algorithm.iterations < 1) {
          throw new TypeError("iterations: Is less than 1");
        }
      }
    }, {
      key: "checkImportKey",
      value: function checkImportKey(format, keyData, algorithm, extractable, keyUsages) {
        var _get2;
        for (var _len14 = arguments.length, args = new Array(_len14 > 5 ? _len14 - 5 : 0), _key17 = 5; _key17 < _len14; _key17++) {
          args[_key17 - 5] = arguments[_key17];
        }
        (_get2 = _get(_getPrototypeOf(Pbkdf2Provider.prototype), "checkImportKey", this)).call.apply(_get2, [this, format, keyData, algorithm, extractable, keyUsages].concat(args));
        if (extractable) {
          throw new SyntaxError("extractable: Must be 'false'");
        }
      }
    }]);
    return Pbkdf2Provider;
  }(ProviderCrypto);
  var ShakeProvider = function (_ProviderCrypto7) {
    _inherits(ShakeProvider, _ProviderCrypto7);
    function ShakeProvider() {
      var _this78;
      _classCallCheck(this, ShakeProvider);
      _this78 = _callSuper(this, ShakeProvider, arguments);
      _this78.usages = [];
      _this78.defaultLength = 0;
      return _this78;
    }
    _createClass(ShakeProvider, [{
      key: "digest",
      value: function digest() {
        for (var _len15 = arguments.length, args = new Array(_len15), _key18 = 0; _key18 < _len15; _key18++) {
          args[_key18] = arguments[_key18];
        }
        args[0] = _objectSpread({
          length: this.defaultLength
        }, args[0]);
        return _get(_getPrototypeOf(ShakeProvider.prototype), "digest", this).apply(this, args);
      }
    }, {
      key: "checkDigest",
      value: function checkDigest(algorithm, data) {
        _get(_getPrototypeOf(ShakeProvider.prototype), "checkDigest", this).call(this, algorithm, data);
        var length = algorithm.length || 0;
        if (typeof length !== "number") {
          throw new TypeError("length: Is not a Number");
        }
        if (length < 0) {
          throw new TypeError("length: Is negative");
        }
      }
    }]);
    return ShakeProvider;
  }(ProviderCrypto);
  var Shake128Provider$1 = function (_ShakeProvider) {
    _inherits(Shake128Provider, _ShakeProvider);
    function Shake128Provider() {
      var _this79;
      _classCallCheck(this, Shake128Provider);
      _this79 = _callSuper(this, Shake128Provider, arguments);
      _this79.name = "shake128";
      _this79.defaultLength = 16;
      return _this79;
    }
    return _createClass(Shake128Provider);
  }(ShakeProvider);
  var Shake256Provider$1 = function (_ShakeProvider2) {
    _inherits(Shake256Provider, _ShakeProvider2);
    function Shake256Provider() {
      var _this80;
      _classCallCheck(this, Shake256Provider);
      _this80 = _callSuper(this, Shake256Provider, arguments);
      _this80.name = "shake256";
      _this80.defaultLength = 32;
      return _this80;
    }
    return _createClass(Shake256Provider);
  }(ShakeProvider);
  var Crypto$1 = function (_Symbol$toStringTag2) {
    function Crypto() {
      _classCallCheck(this, Crypto);
    }
    _createClass(Crypto, [{
      key: _Symbol$toStringTag2,
      get: function get() {
        return "Crypto";
      }
    }, {
      key: "randomUUID",
      value: function randomUUID() {
        var b = this.getRandomValues(new Uint8Array(16));
        b[6] = b[6] & 0x0f | 0x40;
        b[8] = b[8] & 0x3f | 0x80;
        var uuid = Convert.ToHex(b).toLowerCase();
        return "".concat(uuid.substring(0, 8), "-").concat(uuid.substring(8, 12), "-").concat(uuid.substring(12, 16), "-").concat(uuid.substring(16, 20), "-").concat(uuid.substring(20));
      }
    }]);
    return Crypto;
  }(Symbol.toStringTag);
  var ProviderStorage = function () {
    function ProviderStorage() {
      _classCallCheck(this, ProviderStorage);
      this.items = {};
    }
    _createClass(ProviderStorage, [{
      key: "get",
      value: function get(algorithmName) {
        return this.items[algorithmName.toLowerCase()] || null;
      }
    }, {
      key: "set",
      value: function set(provider) {
        this.items[provider.name.toLowerCase()] = provider;
      }
    }, {
      key: "removeAt",
      value: function removeAt(algorithmName) {
        var provider = this.get(algorithmName.toLowerCase());
        if (provider) {
          delete this.items[algorithmName];
        }
        return provider;
      }
    }, {
      key: "has",
      value: function has(name) {
        return !!this.get(name);
      }
    }, {
      key: "length",
      get: function get() {
        return Object.keys(this.items).length;
      }
    }, {
      key: "algorithms",
      get: function get() {
        var algorithms = [];
        for (var key in this.items) {
          var provider = this.items[key];
          algorithms.push(provider.name);
        }
        return algorithms.sort();
      }
    }]);
    return ProviderStorage;
  }();
  var SubtleCrypto$1 = function (_Symbol$toStringTag3) {
    function SubtleCrypto() {
      _classCallCheck(this, SubtleCrypto);
      this.providers = new ProviderStorage();
    }
    _createClass(SubtleCrypto, [{
      key: _Symbol$toStringTag3,
      get: function get() {
        return "SubtleCrypto";
      }
    }, {
      key: "digest",
      value: function () {
        var _digest2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee19() {
          var _len16,
            args,
            _key19,
            algorithm,
            data,
            params,
            preparedAlgorithm,
            preparedData,
            provider,
            result,
            _args20 = arguments;
          return _regeneratorRuntime().wrap(function _callee19$(_context19) {
            while (1) switch (_context19.prev = _context19.next) {
              case 0:
                for (_len16 = _args20.length, args = new Array(_len16), _key19 = 0; _key19 < _len16; _key19++) {
                  args[_key19] = _args20[_key19];
                }
                this.checkRequiredArguments(args, 2, "digest");
                algorithm = args[0], data = args[1], params = args.slice(2);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(data);
                provider = this.getProvider(preparedAlgorithm.name);
                _context19.next = 8;
                return provider.digest.apply(provider, [preparedAlgorithm, preparedData].concat(_toConsumableArray(params)));
              case 8:
                result = _context19.sent;
                return _context19.abrupt("return", result);
              case 10:
              case "end":
                return _context19.stop();
            }
          }, _callee19, this);
        }));
        function digest() {
          return _digest2.apply(this, arguments);
        }
        return digest;
      }()
    }, {
      key: "generateKey",
      value: function () {
        var _generateKey2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee20() {
          var _len17,
            args,
            _key20,
            algorithm,
            extractable,
            keyUsages,
            params,
            preparedAlgorithm,
            provider,
            result,
            _args21 = arguments;
          return _regeneratorRuntime().wrap(function _callee20$(_context20) {
            while (1) switch (_context20.prev = _context20.next) {
              case 0:
                for (_len17 = _args21.length, args = new Array(_len17), _key20 = 0; _key20 < _len17; _key20++) {
                  args[_key20] = _args21[_key20];
                }
                this.checkRequiredArguments(args, 3, "generateKey");
                algorithm = args[0], extractable = args[1], keyUsages = args[2], params = args.slice(3);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                provider = this.getProvider(preparedAlgorithm.name);
                _context20.next = 7;
                return provider.generateKey.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), extractable, keyUsages].concat(_toConsumableArray(params)));
              case 7:
                result = _context20.sent;
                return _context20.abrupt("return", result);
              case 9:
              case "end":
                return _context20.stop();
            }
          }, _callee20, this);
        }));
        function generateKey() {
          return _generateKey2.apply(this, arguments);
        }
        return generateKey;
      }()
    }, {
      key: "sign",
      value: function () {
        var _sign2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee21() {
          var _len18,
            args,
            _key21,
            algorithm,
            key,
            data,
            params,
            preparedAlgorithm,
            preparedData,
            provider,
            result,
            _args22 = arguments;
          return _regeneratorRuntime().wrap(function _callee21$(_context21) {
            while (1) switch (_context21.prev = _context21.next) {
              case 0:
                for (_len18 = _args22.length, args = new Array(_len18), _key21 = 0; _key21 < _len18; _key21++) {
                  args[_key21] = _args22[_key21];
                }
                this.checkRequiredArguments(args, 3, "sign");
                algorithm = args[0], key = args[1], data = args[2], params = args.slice(3);
                this.checkCryptoKey(key);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(data);
                provider = this.getProvider(preparedAlgorithm.name);
                _context21.next = 9;
                return provider.sign.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), key, preparedData].concat(_toConsumableArray(params)));
              case 9:
                result = _context21.sent;
                return _context21.abrupt("return", result);
              case 11:
              case "end":
                return _context21.stop();
            }
          }, _callee21, this);
        }));
        function sign() {
          return _sign2.apply(this, arguments);
        }
        return sign;
      }()
    }, {
      key: "verify",
      value: function () {
        var _verify2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee22() {
          var _len19,
            args,
            _key22,
            algorithm,
            key,
            signature,
            data,
            params,
            preparedAlgorithm,
            preparedData,
            preparedSignature,
            provider,
            result,
            _args23 = arguments;
          return _regeneratorRuntime().wrap(function _callee22$(_context22) {
            while (1) switch (_context22.prev = _context22.next) {
              case 0:
                for (_len19 = _args23.length, args = new Array(_len19), _key22 = 0; _key22 < _len19; _key22++) {
                  args[_key22] = _args23[_key22];
                }
                this.checkRequiredArguments(args, 4, "verify");
                algorithm = args[0], key = args[1], signature = args[2], data = args[3], params = args.slice(4);
                this.checkCryptoKey(key);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(data);
                preparedSignature = BufferSourceConverter.toArrayBuffer(signature);
                provider = this.getProvider(preparedAlgorithm.name);
                _context22.next = 10;
                return provider.verify.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), key, preparedSignature, preparedData].concat(_toConsumableArray(params)));
              case 10:
                result = _context22.sent;
                return _context22.abrupt("return", result);
              case 12:
              case "end":
                return _context22.stop();
            }
          }, _callee22, this);
        }));
        function verify() {
          return _verify2.apply(this, arguments);
        }
        return verify;
      }()
    }, {
      key: "encrypt",
      value: function () {
        var _encrypt3 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee23() {
          var _len20,
            args,
            _key23,
            algorithm,
            key,
            data,
            params,
            preparedAlgorithm,
            preparedData,
            provider,
            result,
            _args24 = arguments;
          return _regeneratorRuntime().wrap(function _callee23$(_context23) {
            while (1) switch (_context23.prev = _context23.next) {
              case 0:
                for (_len20 = _args24.length, args = new Array(_len20), _key23 = 0; _key23 < _len20; _key23++) {
                  args[_key23] = _args24[_key23];
                }
                this.checkRequiredArguments(args, 3, "encrypt");
                algorithm = args[0], key = args[1], data = args[2], params = args.slice(3);
                this.checkCryptoKey(key);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(data);
                provider = this.getProvider(preparedAlgorithm.name);
                _context23.next = 9;
                return provider.encrypt.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), key, preparedData, {
                  keyUsage: true
                }].concat(_toConsumableArray(params)));
              case 9:
                result = _context23.sent;
                return _context23.abrupt("return", result);
              case 11:
              case "end":
                return _context23.stop();
            }
          }, _callee23, this);
        }));
        function encrypt() {
          return _encrypt3.apply(this, arguments);
        }
        return encrypt;
      }()
    }, {
      key: "decrypt",
      value: function () {
        var _decrypt3 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee24() {
          var _len21,
            args,
            _key24,
            algorithm,
            key,
            data,
            params,
            preparedAlgorithm,
            preparedData,
            provider,
            result,
            _args25 = arguments;
          return _regeneratorRuntime().wrap(function _callee24$(_context24) {
            while (1) switch (_context24.prev = _context24.next) {
              case 0:
                for (_len21 = _args25.length, args = new Array(_len21), _key24 = 0; _key24 < _len21; _key24++) {
                  args[_key24] = _args25[_key24];
                }
                this.checkRequiredArguments(args, 3, "decrypt");
                algorithm = args[0], key = args[1], data = args[2], params = args.slice(3);
                this.checkCryptoKey(key);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(data);
                provider = this.getProvider(preparedAlgorithm.name);
                _context24.next = 9;
                return provider.decrypt.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), key, preparedData, {
                  keyUsage: true
                }].concat(_toConsumableArray(params)));
              case 9:
                result = _context24.sent;
                return _context24.abrupt("return", result);
              case 11:
              case "end":
                return _context24.stop();
            }
          }, _callee24, this);
        }));
        function decrypt() {
          return _decrypt3.apply(this, arguments);
        }
        return decrypt;
      }()
    }, {
      key: "deriveBits",
      value: function () {
        var _deriveBits2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee25() {
          var _len22,
            args,
            _key25,
            algorithm,
            baseKey,
            length,
            params,
            preparedAlgorithm,
            provider,
            result,
            _args26 = arguments;
          return _regeneratorRuntime().wrap(function _callee25$(_context25) {
            while (1) switch (_context25.prev = _context25.next) {
              case 0:
                for (_len22 = _args26.length, args = new Array(_len22), _key25 = 0; _key25 < _len22; _key25++) {
                  args[_key25] = _args26[_key25];
                }
                this.checkRequiredArguments(args, 3, "deriveBits");
                algorithm = args[0], baseKey = args[1], length = args[2], params = args.slice(3);
                this.checkCryptoKey(baseKey);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                provider = this.getProvider(preparedAlgorithm.name);
                _context25.next = 8;
                return provider.deriveBits.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), baseKey, length, {
                  keyUsage: true
                }].concat(_toConsumableArray(params)));
              case 8:
                result = _context25.sent;
                return _context25.abrupt("return", result);
              case 10:
              case "end":
                return _context25.stop();
            }
          }, _callee25, this);
        }));
        function deriveBits() {
          return _deriveBits2.apply(this, arguments);
        }
        return deriveBits;
      }()
    }, {
      key: "deriveKey",
      value: function () {
        var _deriveKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee26() {
          var _len23,
            args,
            _key26,
            algorithm,
            baseKey,
            derivedKeyType,
            extractable,
            keyUsages,
            params,
            preparedDerivedKeyType,
            importProvider,
            preparedAlgorithm,
            provider,
            derivedBits,
            _args27 = arguments;
          return _regeneratorRuntime().wrap(function _callee26$(_context26) {
            while (1) switch (_context26.prev = _context26.next) {
              case 0:
                for (_len23 = _args27.length, args = new Array(_len23), _key26 = 0; _key26 < _len23; _key26++) {
                  args[_key26] = _args27[_key26];
                }
                this.checkRequiredArguments(args, 5, "deriveKey");
                algorithm = args[0], baseKey = args[1], derivedKeyType = args[2], extractable = args[3], keyUsages = args[4], params = args.slice(5);
                preparedDerivedKeyType = this.prepareAlgorithm(derivedKeyType);
                importProvider = this.getProvider(preparedDerivedKeyType.name);
                importProvider.checkDerivedKeyParams(preparedDerivedKeyType);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                provider = this.getProvider(preparedAlgorithm.name);
                provider.checkCryptoKey(baseKey, "deriveKey");
                _context26.next = 11;
                return provider.deriveBits.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), baseKey, derivedKeyType.length || 512, {
                  keyUsage: false
                }].concat(_toConsumableArray(params)));
              case 11:
                derivedBits = _context26.sent;
                return _context26.abrupt("return", this.importKey.apply(this, ["raw", derivedBits, derivedKeyType, extractable, keyUsages].concat(_toConsumableArray(params))));
              case 13:
              case "end":
                return _context26.stop();
            }
          }, _callee26, this);
        }));
        function deriveKey() {
          return _deriveKey.apply(this, arguments);
        }
        return deriveKey;
      }()
    }, {
      key: "exportKey",
      value: function () {
        var _exportKey2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee27() {
          var _len24,
            args,
            _key27,
            format,
            key,
            params,
            provider,
            result,
            _args28 = arguments;
          return _regeneratorRuntime().wrap(function _callee27$(_context27) {
            while (1) switch (_context27.prev = _context27.next) {
              case 0:
                for (_len24 = _args28.length, args = new Array(_len24), _key27 = 0; _key27 < _len24; _key27++) {
                  args[_key27] = _args28[_key27];
                }
                this.checkRequiredArguments(args, 2, "exportKey");
                format = args[0], key = args[1], params = args.slice(2);
                this.checkCryptoKey(key);
                provider = this.getProvider(key.algorithm.name);
                _context27.next = 7;
                return provider.exportKey.apply(provider, [format, key].concat(_toConsumableArray(params)));
              case 7:
                result = _context27.sent;
                return _context27.abrupt("return", result);
              case 9:
              case "end":
                return _context27.stop();
            }
          }, _callee27, this);
        }));
        function exportKey() {
          return _exportKey2.apply(this, arguments);
        }
        return exportKey;
      }()
    }, {
      key: "importKey",
      value: function () {
        var _importKey2 = _asyncToGenerator(_regeneratorRuntime().mark(function _callee28() {
          var _len25,
            args,
            _key28,
            format,
            keyData,
            algorithm,
            extractable,
            keyUsages,
            params,
            preparedAlgorithm,
            provider,
            preparedData,
            _args29 = arguments;
          return _regeneratorRuntime().wrap(function _callee28$(_context28) {
            while (1) switch (_context28.prev = _context28.next) {
              case 0:
                for (_len25 = _args29.length, args = new Array(_len25), _key28 = 0; _key28 < _len25; _key28++) {
                  args[_key28] = _args29[_key28];
                }
                this.checkRequiredArguments(args, 5, "importKey");
                format = args[0], keyData = args[1], algorithm = args[2], extractable = args[3], keyUsages = args[4], params = args.slice(5);
                preparedAlgorithm = this.prepareAlgorithm(algorithm);
                provider = this.getProvider(preparedAlgorithm.name);
                if (!(["pkcs8", "spki", "raw"].indexOf(format) !== -1)) {
                  _context28.next = 10;
                  break;
                }
                preparedData = BufferSourceConverter.toArrayBuffer(keyData);
                return _context28.abrupt("return", provider.importKey.apply(provider, [format, preparedData, _objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), extractable, keyUsages].concat(_toConsumableArray(params))));
              case 10:
                if (keyData.kty) {
                  _context28.next = 12;
                  break;
                }
                throw new TypeError("keyData: Is not JSON");
              case 12:
                return _context28.abrupt("return", provider.importKey.apply(provider, [format, keyData, _objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), extractable, keyUsages].concat(_toConsumableArray(params))));
              case 13:
              case "end":
                return _context28.stop();
            }
          }, _callee28, this);
        }));
        function importKey() {
          return _importKey2.apply(this, arguments);
        }
        return importKey;
      }()
    }, {
      key: "wrapKey",
      value: function () {
        var _wrapKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee29(format, key, wrappingKey, wrapAlgorithm) {
          var _len26,
            args,
            _key29,
            keyData,
            json,
            preparedAlgorithm,
            preparedData,
            provider,
            _args30 = arguments;
          return _regeneratorRuntime().wrap(function _callee29$(_context29) {
            while (1) switch (_context29.prev = _context29.next) {
              case 0:
                for (_len26 = _args30.length, args = new Array(_len26 > 4 ? _len26 - 4 : 0), _key29 = 4; _key29 < _len26; _key29++) {
                  args[_key29 - 4] = _args30[_key29];
                }
                _context29.next = 3;
                return this.exportKey.apply(this, [format, key].concat(args));
              case 3:
                keyData = _context29.sent;
                if (format === "jwk") {
                  json = JSON.stringify(keyData);
                  keyData = Convert.FromUtf8String(json);
                }
                preparedAlgorithm = this.prepareAlgorithm(wrapAlgorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(keyData);
                provider = this.getProvider(preparedAlgorithm.name);
                return _context29.abrupt("return", provider.encrypt.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), wrappingKey, preparedData, {
                  keyUsage: false
                }].concat(args)));
              case 9:
              case "end":
                return _context29.stop();
            }
          }, _callee29, this);
        }));
        function wrapKey(_x29, _x30, _x31, _x32) {
          return _wrapKey.apply(this, arguments);
        }
        return wrapKey;
      }()
    }, {
      key: "unwrapKey",
      value: function () {
        var _unwrapKey = _asyncToGenerator(_regeneratorRuntime().mark(function _callee30(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) {
          var preparedAlgorithm,
            preparedData,
            provider,
            _len27,
            args,
            _key30,
            keyData,
            error,
            _args31 = arguments;
          return _regeneratorRuntime().wrap(function _callee30$(_context30) {
            while (1) switch (_context30.prev = _context30.next) {
              case 0:
                preparedAlgorithm = this.prepareAlgorithm(unwrapAlgorithm);
                preparedData = BufferSourceConverter.toArrayBuffer(wrappedKey);
                provider = this.getProvider(preparedAlgorithm.name);
                for (_len27 = _args31.length, args = new Array(_len27 > 7 ? _len27 - 7 : 0), _key30 = 7; _key30 < _len27; _key30++) {
                  args[_key30 - 7] = _args31[_key30];
                }
                _context30.next = 6;
                return provider.decrypt.apply(provider, [_objectSpread(_objectSpread({}, preparedAlgorithm), {}, {
                  name: provider.name
                }), unwrappingKey, preparedData, {
                  keyUsage: false
                }].concat(args));
              case 6:
                keyData = _context30.sent;
                if (!(format === "jwk")) {
                  _context30.next = 17;
                  break;
                }
                _context30.prev = 8;
                keyData = JSON.parse(Convert.ToUtf8String(keyData));
                _context30.next = 17;
                break;
              case 12:
                _context30.prev = 12;
                _context30.t0 = _context30["catch"](8);
                error = new TypeError("wrappedKey: Is not a JSON");
                error.internal = _context30.t0;
                throw error;
              case 17:
                return _context30.abrupt("return", this.importKey.apply(this, [format, keyData, unwrappedKeyAlgorithm, extractable, keyUsages].concat(args)));
              case 18:
              case "end":
                return _context30.stop();
            }
          }, _callee30, this, [[8, 12]]);
        }));
        function unwrapKey(_x33, _x34, _x35, _x36, _x37, _x38, _x39) {
          return _unwrapKey.apply(this, arguments);
        }
        return unwrapKey;
      }()
    }, {
      key: "checkRequiredArguments",
      value: function checkRequiredArguments(args, size, methodName) {
        if (args.length < size) {
          throw new TypeError("Failed to execute '".concat(methodName, "' on 'SubtleCrypto': ").concat(size, " arguments required, but only ").concat(args.length, " present"));
        }
      }
    }, {
      key: "prepareAlgorithm",
      value: function prepareAlgorithm(algorithm) {
        if (typeof algorithm === "string") {
          return {
            name: algorithm
          };
        }
        if (SubtleCrypto.isHashedAlgorithm(algorithm)) {
          var preparedAlgorithm = _objectSpread({}, algorithm);
          preparedAlgorithm.hash = this.prepareAlgorithm(algorithm.hash);
          return preparedAlgorithm;
        }
        return _objectSpread({}, algorithm);
      }
    }, {
      key: "getProvider",
      value: function getProvider(name) {
        var provider = this.providers.get(name);
        if (!provider) {
          throw new AlgorithmError("Unrecognized name");
        }
        return provider;
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key) {
        if (!(key instanceof CryptoKey$1)) {
          throw new TypeError("Key is not of type 'CryptoKey'");
        }
      }
    }], [{
      key: "isHashedAlgorithm",
      value: function isHashedAlgorithm(data) {
        return data && _typeof(data) === "object" && "name" in data && "hash" in data ? true : false;
      }
    }]);
    return SubtleCrypto;
  }(Symbol.toStringTag);
  var Debug = function () {
    function Debug() {
      _classCallCheck(this, Debug);
    }
    _createClass(Debug, null, [{
      key: "enabled",
      get: function get() {
        return typeof self !== "undefined" && self.PV_WEBCRYPTO_LINER_LOG;
      }
    }, {
      key: "log",
      value: function log() {
        if (this.enabled) {
          var _console;
          (_console = console).log.apply(_console, arguments);
        }
      }
    }, {
      key: "error",
      value: function error() {
        if (this.enabled) {
          var _console2;
          (_console2 = console).error.apply(_console2, arguments);
        }
      }
    }, {
      key: "info",
      value: function info() {
        if (this.enabled) {
          var _console3;
          (_console3 = console).info.apply(_console3, arguments);
        }
      }
    }, {
      key: "warn",
      value: function warn() {
        if (this.enabled) {
          var _console4;
          (_console4 = console).warn.apply(_console4, arguments);
        }
      }
    }, {
      key: "trace",
      value: function trace() {
        if (this.enabled) {
          var _console5;
          (_console5 = console).trace.apply(_console5, arguments);
        }
      }
    }]);
    return Debug;
  }();
  var Browser;
  (function (Browser) {
    Browser["Unknown"] = "Unknown";
    Browser["IE"] = "Internet Explorer";
    Browser["Safari"] = "Safari";
    Browser["Edge"] = "Edge";
    Browser["Chrome"] = "Chrome";
    Browser["Firefox"] = "Firefox Mozilla";
    Browser["Mobile"] = "Mobile";
  })(Browser || (Browser = {}));
  function BrowserInfo() {
    var res = {
      name: Browser.Unknown,
      version: "0"
    };
    if (typeof self === "undefined") {
      return res;
    }
    var userAgent = self.navigator.userAgent;
    var reg = /edge\/([\d.]+)/i.exec(userAgent);
    if (reg) {
      res.name = Browser.Edge;
      res.version = reg[1];
    } else if (/msie/i.test(userAgent)) {
      res.name = Browser.IE;
      res.version = /msie ([\d.]+)/i.exec(userAgent)[1];
    } else if (/Trident/i.test(userAgent)) {
      res.name = Browser.IE;
      res.version = /rv:([\d.]+)/i.exec(userAgent)[1];
    } else if (/chrome/i.test(userAgent)) {
      res.name = Browser.Chrome;
      res.version = /chrome\/([\d.]+)/i.exec(userAgent)[1];
    } else if (/firefox/i.test(userAgent)) {
      res.name = Browser.Firefox;
      res.version = /firefox\/([\d.]+)/i.exec(userAgent)[1];
    } else if (/mobile/i.test(userAgent)) {
      res.name = Browser.Mobile;
      res.version = /mobile\/([\w]+)/i.exec(userAgent)[1];
    } else if (/safari/i.test(userAgent)) {
      res.name = Browser.Safari;
      res.version = /version\/([\d.]+)/i.exec(userAgent)[1];
    }
    return res;
  }
  function concat() {
    for (var _len28 = arguments.length, buf = new Array(_len28), _key31 = 0; _key31 < _len28; _key31++) {
      buf[_key31] = arguments[_key31];
    }
    var res = new Uint8Array(buf.map(function (item) {
      return item.length;
    }).reduce(function (prev, cur) {
      return prev + cur;
    }));
    var offset = 0;
    buf.forEach(function (item) {
      for (var i = 0; i < item.length; i++) {
        res[offset + i] = item[i];
      }
      offset += item.length;
    });
    return res;
  }
  var CryptoKey = function (_CryptoKey$) {
    _inherits(CryptoKey, _CryptoKey$);
    function CryptoKey(algorithm, extractable, type, usages) {
      var _this81;
      _classCallCheck(this, CryptoKey);
      _this81 = _callSuper(this, CryptoKey);
      _this81.extractable = extractable;
      _this81.type = type;
      _this81.usages = usages;
      _this81.algorithm = Object.assign({}, algorithm);
      return _this81;
    }
    return _createClass(CryptoKey);
  }(CryptoKey$1);
  function isAlgorithm(algorithm, name) {
    return algorithm.name.toUpperCase() === name.toUpperCase();
  }
  var AesCryptoKey = function (_CryptoKey) {
    _inherits(AesCryptoKey, _CryptoKey);
    function AesCryptoKey(algorithm, extractable, usages, raw) {
      var _this82;
      _classCallCheck(this, AesCryptoKey);
      _this82 = _callSuper(this, AesCryptoKey, [algorithm, extractable, "secret", usages]);
      _this82.raw = raw;
      return _this82;
    }
    _createClass(AesCryptoKey, [{
      key: "toJSON",
      value: function toJSON() {
        var jwk = {
          kty: "oct",
          alg: this.getJwkAlgorithm(),
          k: Convert.ToBase64Url(this.raw),
          ext: this.extractable,
          key_ops: this.usages
        };
        return jwk;
      }
    }, {
      key: "getJwkAlgorithm",
      value: function getJwkAlgorithm() {
        switch (this.algorithm.name.toUpperCase()) {
          case "AES-CBC":
            return "A".concat(this.algorithm.length, "CBC");
          case "AES-CTR":
            return "A".concat(this.algorithm.length, "CTR");
          case "AES-GCM":
            return "A".concat(this.algorithm.length, "GCM");
          case "AES-ECB":
            return "A".concat(this.algorithm.length, "ECB");
          default:
            throw new AlgorithmError("Unsupported algorithm name");
        }
      }
    }]);
    return AesCryptoKey;
  }(CryptoKey);
  var AesCrypto = function () {
    function AesCrypto() {
      _classCallCheck(this, AesCrypto);
    }
    _createClass(AesCrypto, null, [{
      key: "checkCryptoKey",
      value: function checkCryptoKey(key) {
        if (!(key instanceof AesCryptoKey)) {
          throw new TypeError("key: Is not AesCryptoKey");
        }
      }
    }, {
      key: "generateKey",
      value: function generateKey(algorithm, extractable, usages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee31() {
          var raw;
          return _regeneratorRuntime().wrap(function _callee31$(_context31) {
            while (1) switch (_context31.prev = _context31.next) {
              case 0:
                raw = exports.nativeCrypto.getRandomValues(new Uint8Array(algorithm.length / 8));
                return _context31.abrupt("return", new AesCryptoKey(algorithm, extractable, usages, raw));
              case 2:
              case "end":
                return _context31.stop();
            }
          }, _callee31);
        }));
      }
    }, {
      key: "encrypt",
      value: function encrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee32() {
          return _regeneratorRuntime().wrap(function _callee32$(_context32) {
            while (1) switch (_context32.prev = _context32.next) {
              case 0:
                return _context32.abrupt("return", this.cipher(algorithm, key, BufferSourceConverter.toUint8Array(data), true));
              case 1:
              case "end":
                return _context32.stop();
            }
          }, _callee32, this);
        }));
      }
    }, {
      key: "decrypt",
      value: function decrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee33() {
          return _regeneratorRuntime().wrap(function _callee33$(_context33) {
            while (1) switch (_context33.prev = _context33.next) {
              case 0:
                return _context33.abrupt("return", this.cipher(algorithm, key, BufferSourceConverter.toUint8Array(data), false));
              case 1:
              case "end":
                return _context33.stop();
            }
          }, _callee33, this);
        }));
      }
    }, {
      key: "exportKey",
      value: function exportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee34() {
          return _regeneratorRuntime().wrap(function _callee34$(_context34) {
            while (1) switch (_context34.prev = _context34.next) {
              case 0:
                _context34.t0 = format;
                _context34.next = _context34.t0 === "jwk" ? 3 : _context34.t0 === "raw" ? 4 : 5;
                break;
              case 3:
                return _context34.abrupt("return", key.toJSON());
              case 4:
                return _context34.abrupt("return", key.raw.buffer);
              case 5:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
              case 6:
              case "end":
                return _context34.stop();
            }
          }, _callee34);
        }));
      }
    }, {
      key: "importKey",
      value: function importKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee35() {
          var raw, key;
          return _regeneratorRuntime().wrap(function _callee35$(_context35) {
            while (1) switch (_context35.prev = _context35.next) {
              case 0:
                if (isJWK(keyData)) {
                  raw = Convert.FromBase64Url(keyData.k);
                } else {
                  raw = BufferSourceConverter.toArrayBuffer(keyData);
                }
                _context35.t0 = raw.byteLength << 3;
                _context35.next = _context35.t0 === 128 ? 4 : _context35.t0 === 192 ? 4 : _context35.t0 === 256 ? 4 : 5;
                break;
              case 4:
                return _context35.abrupt("break", 6);
              case 5:
                throw new OperationError("keyData: Is wrong key length");
              case 6:
                key = new AesCryptoKey({
                  name: algorithm.name,
                  length: raw.byteLength << 3
                }, extractable, keyUsages, new Uint8Array(raw));
                return _context35.abrupt("return", key);
              case 8:
              case "end":
                return _context35.stop();
            }
          }, _callee35);
        }));
      }
    }, {
      key: "cipher",
      value: function cipher(algorithm, key, data, encrypt) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee36() {
          var action, result, iv, _iv, additionalData, tagLength;
          return _regeneratorRuntime().wrap(function _callee36$(_context36) {
            while (1) switch (_context36.prev = _context36.next) {
              case 0:
                action = encrypt ? "encrypt" : "decrypt";
                if (!isAlgorithm(algorithm, AesCrypto.AesCBC)) {
                  _context36.next = 6;
                  break;
                }
                iv = BufferSourceConverter.toUint8Array(algorithm.iv);
                result = asmCrypto__namespace.AES_CBC[action](data, key.raw, undefined, iv);
                _context36.next = 18;
                break;
              case 6:
                if (!isAlgorithm(algorithm, AesCrypto.AesGCM)) {
                  _context36.next = 13;
                  break;
                }
                _iv = BufferSourceConverter.toUint8Array(algorithm.iv);
                if (algorithm.additionalData) {
                  additionalData = BufferSourceConverter.toUint8Array(algorithm.additionalData);
                }
                tagLength = (algorithm.tagLength || 128) / 8;
                result = asmCrypto__namespace.AES_GCM[action](data, key.raw, _iv, additionalData, tagLength);
                _context36.next = 18;
                break;
              case 13:
                if (!isAlgorithm(algorithm, AesCrypto.AesECB)) {
                  _context36.next = 17;
                  break;
                }
                result = asmCrypto__namespace.AES_ECB[action](data, key.raw, true);
                _context36.next = 18;
                break;
              case 17:
                throw new OperationError("algorithm: Is not recognized");
              case 18:
                return _context36.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 19:
              case "end":
                return _context36.stop();
            }
          }, _callee36);
        }));
      }
    }]);
    return AesCrypto;
  }();
  AesCrypto.AesCBC = "AES-CBC";
  AesCrypto.AesECB = "AES-ECB";
  AesCrypto.AesGCM = "AES-GCM";
  var AesCbcProvider = function (_AesCbcProvider$) {
    _inherits(AesCbcProvider, _AesCbcProvider$);
    function AesCbcProvider() {
      _classCallCheck(this, AesCbcProvider);
      return _callSuper(this, AesCbcProvider, arguments);
    }
    _createClass(AesCbcProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee37() {
          return _regeneratorRuntime().wrap(function _callee37$(_context37) {
            while (1) switch (_context37.prev = _context37.next) {
              case 0:
                return _context37.abrupt("return", AesCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context37.stop();
            }
          }, _callee37);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee38() {
          return _regeneratorRuntime().wrap(function _callee38$(_context38) {
            while (1) switch (_context38.prev = _context38.next) {
              case 0:
                return _context38.abrupt("return", AesCrypto.encrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context38.stop();
            }
          }, _callee38);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee39() {
          return _regeneratorRuntime().wrap(function _callee39$(_context39) {
            while (1) switch (_context39.prev = _context39.next) {
              case 0:
                return _context39.abrupt("return", AesCrypto.decrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context39.stop();
            }
          }, _callee39);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee40() {
          return _regeneratorRuntime().wrap(function _callee40$(_context40) {
            while (1) switch (_context40.prev = _context40.next) {
              case 0:
                return _context40.abrupt("return", AesCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context40.stop();
            }
          }, _callee40);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee41() {
          return _regeneratorRuntime().wrap(function _callee41$(_context41) {
            while (1) switch (_context41.prev = _context41.next) {
              case 0:
                return _context41.abrupt("return", AesCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context41.stop();
            }
          }, _callee41);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(AesCbcProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        AesCrypto.checkCryptoKey(key);
      }
    }]);
    return AesCbcProvider;
  }(AesCbcProvider$1);
  var AesEcbProvider = function (_AesEcbProvider$) {
    _inherits(AesEcbProvider, _AesEcbProvider$);
    function AesEcbProvider() {
      _classCallCheck(this, AesEcbProvider);
      return _callSuper(this, AesEcbProvider, arguments);
    }
    _createClass(AesEcbProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee42() {
          return _regeneratorRuntime().wrap(function _callee42$(_context42) {
            while (1) switch (_context42.prev = _context42.next) {
              case 0:
                return _context42.abrupt("return", AesCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context42.stop();
            }
          }, _callee42);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee43() {
          return _regeneratorRuntime().wrap(function _callee43$(_context43) {
            while (1) switch (_context43.prev = _context43.next) {
              case 0:
                return _context43.abrupt("return", AesCrypto.encrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context43.stop();
            }
          }, _callee43);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee44() {
          return _regeneratorRuntime().wrap(function _callee44$(_context44) {
            while (1) switch (_context44.prev = _context44.next) {
              case 0:
                return _context44.abrupt("return", AesCrypto.decrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context44.stop();
            }
          }, _callee44);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee45() {
          return _regeneratorRuntime().wrap(function _callee45$(_context45) {
            while (1) switch (_context45.prev = _context45.next) {
              case 0:
                return _context45.abrupt("return", AesCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context45.stop();
            }
          }, _callee45);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee46() {
          return _regeneratorRuntime().wrap(function _callee46$(_context46) {
            while (1) switch (_context46.prev = _context46.next) {
              case 0:
                return _context46.abrupt("return", AesCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context46.stop();
            }
          }, _callee46);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(AesEcbProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        AesCrypto.checkCryptoKey(key);
      }
    }]);
    return AesEcbProvider;
  }(AesEcbProvider$1);
  var AesGcmProvider = function (_AesGcmProvider$) {
    _inherits(AesGcmProvider, _AesGcmProvider$);
    function AesGcmProvider() {
      _classCallCheck(this, AesGcmProvider);
      return _callSuper(this, AesGcmProvider, arguments);
    }
    _createClass(AesGcmProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee47() {
          return _regeneratorRuntime().wrap(function _callee47$(_context47) {
            while (1) switch (_context47.prev = _context47.next) {
              case 0:
                return _context47.abrupt("return", AesCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context47.stop();
            }
          }, _callee47);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee48() {
          return _regeneratorRuntime().wrap(function _callee48$(_context48) {
            while (1) switch (_context48.prev = _context48.next) {
              case 0:
                return _context48.abrupt("return", AesCrypto.encrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context48.stop();
            }
          }, _callee48);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee49() {
          return _regeneratorRuntime().wrap(function _callee49$(_context49) {
            while (1) switch (_context49.prev = _context49.next) {
              case 0:
                return _context49.abrupt("return", AesCrypto.decrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context49.stop();
            }
          }, _callee49);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee50() {
          return _regeneratorRuntime().wrap(function _callee50$(_context50) {
            while (1) switch (_context50.prev = _context50.next) {
              case 0:
                return _context50.abrupt("return", AesCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context50.stop();
            }
          }, _callee50);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee51() {
          return _regeneratorRuntime().wrap(function _callee51$(_context51) {
            while (1) switch (_context51.prev = _context51.next) {
              case 0:
                return _context51.abrupt("return", AesCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context51.stop();
            }
          }, _callee51);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(AesGcmProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        AesCrypto.checkCryptoKey(key);
      }
    }]);
    return AesGcmProvider;
  }(AesGcmProvider$1);
  var AesCtrProvider = function (_AesCtrProvider$) {
    _inherits(AesCtrProvider, _AesCtrProvider$);
    function AesCtrProvider() {
      _classCallCheck(this, AesCtrProvider);
      return _callSuper(this, AesCtrProvider, arguments);
    }
    _createClass(AesCtrProvider, [{
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee52() {
          var result;
          return _regeneratorRuntime().wrap(function _callee52$(_context52) {
            while (1) switch (_context52.prev = _context52.next) {
              case 0:
                result = new asmCrypto__namespace.AES_CTR(key.raw, BufferSourceConverter.toUint8Array(algorithm.counter)).encrypt(BufferSourceConverter.toUint8Array(data));
                return _context52.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 2:
              case "end":
                return _context52.stop();
            }
          }, _callee52);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee53() {
          var result;
          return _regeneratorRuntime().wrap(function _callee53$(_context53) {
            while (1) switch (_context53.prev = _context53.next) {
              case 0:
                result = new asmCrypto__namespace.AES_CTR(key.raw, BufferSourceConverter.toUint8Array(algorithm.counter)).decrypt(BufferSourceConverter.toUint8Array(data));
                return _context53.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 2:
              case "end":
                return _context53.stop();
            }
          }, _callee53);
        }));
      }
    }, {
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee54() {
          return _regeneratorRuntime().wrap(function _callee54$(_context54) {
            while (1) switch (_context54.prev = _context54.next) {
              case 0:
                return _context54.abrupt("return", AesCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context54.stop();
            }
          }, _callee54);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee55() {
          return _regeneratorRuntime().wrap(function _callee55$(_context55) {
            while (1) switch (_context55.prev = _context55.next) {
              case 0:
                return _context55.abrupt("return", AesCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context55.stop();
            }
          }, _callee55);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee56() {
          return _regeneratorRuntime().wrap(function _callee56$(_context56) {
            while (1) switch (_context56.prev = _context56.next) {
              case 0:
                return _context56.abrupt("return", AesCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context56.stop();
            }
          }, _callee56);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(AesCtrProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        AesCrypto.checkCryptoKey(key);
      }
    }]);
    return AesCtrProvider;
  }(AesCtrProvider$1);
  var AesKwProvider = function (_AesKwProvider$) {
    _inherits(AesKwProvider, _AesKwProvider$);
    function AesKwProvider() {
      _classCallCheck(this, AesKwProvider);
      return _callSuper(this, AesKwProvider, arguments);
    }
    _createClass(AesKwProvider, [{
      key: "onEncrypt",
      value: function onEncrypt(_algorithm, _key, _data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee57() {
          return _regeneratorRuntime().wrap(function _callee57$(_context57) {
            while (1) switch (_context57.prev = _context57.next) {
              case 0:
                throw new Error("Method not implemented.");
              case 1:
              case "end":
                return _context57.stop();
            }
          }, _callee57);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(_algorithm, _key, _data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee58() {
          return _regeneratorRuntime().wrap(function _callee58$(_context58) {
            while (1) switch (_context58.prev = _context58.next) {
              case 0:
                throw new Error("Method not implemented.");
              case 1:
              case "end":
                return _context58.stop();
            }
          }, _callee58);
        }));
      }
    }, {
      key: "onGenerateKey",
      value: function onGenerateKey(_algorithm, _extractable, _keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee59() {
          return _regeneratorRuntime().wrap(function _callee59$(_context59) {
            while (1) switch (_context59.prev = _context59.next) {
              case 0:
                throw new Error("Method not implemented.");
              case 1:
              case "end":
                return _context59.stop();
            }
          }, _callee59);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(_format, _key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee60() {
          return _regeneratorRuntime().wrap(function _callee60$(_context60) {
            while (1) switch (_context60.prev = _context60.next) {
              case 0:
                throw new Error("Method not implemented.");
              case 1:
              case "end":
                return _context60.stop();
            }
          }, _callee60);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(_format, _keyData, _algorithm, _extractable, _keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee61() {
          return _regeneratorRuntime().wrap(function _callee61$(_context61) {
            while (1) switch (_context61.prev = _context61.next) {
              case 0:
                throw new Error("Method not implemented.");
              case 1:
              case "end":
                return _context61.stop();
            }
          }, _callee61);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(AesKwProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        AesCrypto.checkCryptoKey(key);
      }
    }]);
    return AesKwProvider;
  }(AesKwProvider$1);
  var RsaCryptoKey = function (_CryptoKey2) {
    _inherits(RsaCryptoKey, _CryptoKey2);
    function RsaCryptoKey(algorithm, extractable, type, usages, data) {
      var _this83;
      _classCallCheck(this, RsaCryptoKey);
      _this83 = _callSuper(this, RsaCryptoKey, [algorithm, extractable, type, usages]);
      _this83.data = data;
      return _this83;
    }
    return _createClass(RsaCryptoKey);
  }(CryptoKey);
  var RsaCrypto = function () {
    function RsaCrypto() {
      _classCallCheck(this, RsaCrypto);
    }
    _createClass(RsaCrypto, null, [{
      key: "checkCryptoKey",
      value: function checkCryptoKey(key) {
        if (!(key instanceof RsaCryptoKey)) {
          throw new TypeError("key: Is not RsaCryptoKey");
        }
      }
    }, {
      key: "generateKey",
      value: function generateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee62() {
          var _this84 = this;
          var alg, keys, crypto, pkcs8, privateKey, spki, publicKey;
          return _regeneratorRuntime().wrap(function _callee62$(_context62) {
            while (1) switch (_context62.prev = _context62.next) {
              case 0:
                alg = {
                  name: "RSA-PSS",
                  hash: "SHA-256",
                  publicExponent: algorithm.publicExponent,
                  modulusLength: algorithm.modulusLength
                };
                _context62.next = 3;
                return exports.nativeSubtle.generateKey(alg, true, ["sign", "verify"]);
              case 3:
                keys = _context62.sent;
                crypto = new Crypto();
                _context62.next = 7;
                return crypto.subtle.exportKey("pkcs8", keys.privateKey);
              case 7:
                pkcs8 = _context62.sent;
                _context62.next = 10;
                return crypto.subtle.importKey("pkcs8", pkcs8, algorithm, extractable, keyUsages.filter(function (o) {
                  return _this84.privateUsages.includes(o);
                }));
              case 10:
                privateKey = _context62.sent;
                _context62.next = 13;
                return crypto.subtle.exportKey("spki", keys.publicKey);
              case 13:
                spki = _context62.sent;
                _context62.next = 16;
                return crypto.subtle.importKey("spki", spki, algorithm, true, keyUsages.filter(function (o) {
                  return _this84.publicUsages.includes(o);
                }));
              case 16:
                publicKey = _context62.sent;
                return _context62.abrupt("return", {
                  privateKey: privateKey,
                  publicKey: publicKey
                });
              case 18:
              case "end":
                return _context62.stop();
            }
          }, _callee62);
        }));
      }
    }, {
      key: "exportKey",
      value: function exportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee63() {
          return _regeneratorRuntime().wrap(function _callee63$(_context63) {
            while (1) switch (_context63.prev = _context63.next) {
              case 0:
                _context63.t0 = format;
                _context63.next = _context63.t0 === "pkcs8" ? 3 : _context63.t0 === "spki" ? 4 : _context63.t0 === "jwk" ? 5 : 6;
                break;
              case 3:
                return _context63.abrupt("return", this.exportPkcs8Key(key));
              case 4:
                return _context63.abrupt("return", this.exportSpkiKey(key));
              case 5:
                return _context63.abrupt("return", this.exportJwkKey(key));
              case 6:
                throw new OperationError("format: Must be 'jwk', 'pkcs8' or 'spki'");
              case 7:
              case "end":
                return _context63.stop();
            }
          }, _callee63, this);
        }));
      }
    }, {
      key: "importKey",
      value: function importKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee64() {
          var asmKey, key;
          return _regeneratorRuntime().wrap(function _callee64$(_context64) {
            while (1) switch (_context64.prev = _context64.next) {
              case 0:
                _context64.t0 = format;
                _context64.next = _context64.t0 === "pkcs8" ? 3 : _context64.t0 === "spki" ? 5 : _context64.t0 === "jwk" ? 7 : 9;
                break;
              case 3:
                asmKey = this.importPkcs8Key(keyData);
                return _context64.abrupt("break", 10);
              case 5:
                asmKey = this.importSpkiKey(keyData);
                return _context64.abrupt("break", 10);
              case 7:
                asmKey = this.importJwkKey(keyData);
                return _context64.abrupt("break", 10);
              case 9:
                throw new OperationError("format: Must be 'jwk', 'pkcs8' or 'spki'");
              case 10:
                key = new RsaCryptoKey(Object.assign({
                  publicExponent: asmKey[1][1] === 1 ? asmKey[1].slice(1) : asmKey[1].slice(3),
                  modulusLength: asmKey[0].byteLength << 3
                }, algorithm), extractable, asmKey.length === 2 ? "public" : "private", keyUsages, asmKey);
                return _context64.abrupt("return", key);
              case 12:
              case "end":
                return _context64.stop();
            }
          }, _callee64, this);
        }));
      }
    }, {
      key: "randomNonZeroValues",
      value: function randomNonZeroValues(data) {
        data = exports.nativeCrypto.getRandomValues(data);
        return data.map(function (n) {
          while (!n) {
            n = exports.nativeCrypto.getRandomValues(new Uint8Array(1))[0];
          }
          return n;
        });
      }
    }, {
      key: "exportPkcs8Key",
      value: function exportPkcs8Key(key) {
        var keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.privateKeyAlgorithm.parameters = null;
        keyInfo.privateKey = AsnConvert.serialize(this.exportAsmKey(key.data));
        return AsnConvert.serialize(keyInfo);
      }
    }, {
      key: "importPkcs8Key",
      value: function importPkcs8Key(data) {
        var keyInfo = AsnConvert.parse(data, index$1.PrivateKeyInfo);
        var privateKey = AsnConvert.parse(keyInfo.privateKey, index$1.RsaPrivateKey);
        return this.importAsmKey(privateKey);
      }
    }, {
      key: "importSpkiKey",
      value: function importSpkiKey(data) {
        var keyInfo = AsnConvert.parse(data, index$1.PublicKeyInfo);
        var publicKey = AsnConvert.parse(keyInfo.publicKey, index$1.RsaPublicKey);
        return this.importAsmKey(publicKey);
      }
    }, {
      key: "exportSpkiKey",
      value: function exportSpkiKey(key) {
        var publicKey = new index$1.RsaPublicKey();
        publicKey.modulus = key.data[0].buffer;
        publicKey.publicExponent = key.data[1][1] === 1 ? key.data[1].buffer.slice(1) : key.data[1].buffer.slice(3);
        var keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.publicKeyAlgorithm.parameters = null;
        keyInfo.publicKey = AsnConvert.serialize(publicKey);
        return AsnConvert.serialize(keyInfo);
      }
    }, {
      key: "importJwkKey",
      value: function importJwkKey(data) {
        var key;
        if (data.d) {
          key = JsonParser.fromJSON(data, {
            targetSchema: index$1.RsaPrivateKey
          });
        } else {
          key = JsonParser.fromJSON(data, {
            targetSchema: index$1.RsaPublicKey
          });
        }
        return this.importAsmKey(key);
      }
    }, {
      key: "exportJwkKey",
      value: function exportJwkKey(key) {
        var asnKey = this.exportAsmKey(key.data);
        var jwk = JsonSerializer.toJSON(asnKey);
        jwk.ext = true;
        jwk.key_ops = key.usages;
        jwk.kty = "RSA";
        jwk.alg = this.getJwkAlgorithm(key.algorithm);
        return jwk;
      }
    }, {
      key: "getJwkAlgorithm",
      value: function getJwkAlgorithm(algorithm) {
        switch (algorithm.name.toUpperCase()) {
          case "RSA-OAEP":
            {
              var mdSize = /(\d+)$/.exec(algorithm.hash.name)[1];
              return "RSA-OAEP".concat(mdSize !== "1" ? "-".concat(mdSize) : "");
            }
          case "RSASSA-PKCS1-V1_5":
            return "RS".concat(/(\d+)$/.exec(algorithm.hash.name)[1]);
          case "RSA-PSS":
            return "PS".concat(/(\d+)$/.exec(algorithm.hash.name)[1]);
          case "RSAES-PKCS1-V1_5":
            return "PS1";
          default:
            throw new OperationError("algorithm: Is not recognized");
        }
      }
    }, {
      key: "exportAsmKey",
      value: function exportAsmKey(asmKey) {
        var key;
        if (asmKey.length > 2) {
          var privateKey = new index$1.RsaPrivateKey();
          privateKey.privateExponent = asmKey[2].buffer;
          privateKey.prime1 = asmKey[3].buffer;
          privateKey.prime2 = asmKey[4].buffer;
          privateKey.exponent1 = asmKey[5].buffer;
          privateKey.exponent2 = asmKey[6].buffer;
          privateKey.coefficient = asmKey[7].buffer;
          key = privateKey;
        } else {
          key = new index$1.RsaPublicKey();
        }
        key.modulus = asmKey[0].buffer;
        key.publicExponent = asmKey[1][1] === 1 ? asmKey[1].buffer.slice(1) : asmKey[1].buffer.slice(3);
        return key;
      }
    }, {
      key: "importAsmKey",
      value: function importAsmKey(key) {
        var expPadding = new Uint8Array(4 - key.publicExponent.byteLength);
        var asmKey = [new Uint8Array(key.modulus), concat(expPadding, new Uint8Array(key.publicExponent))];
        if (key instanceof index$1.RsaPrivateKey) {
          asmKey.push(new Uint8Array(key.privateExponent));
          asmKey.push(new Uint8Array(key.prime1));
          asmKey.push(new Uint8Array(key.prime2));
          asmKey.push(new Uint8Array(key.exponent1));
          asmKey.push(new Uint8Array(key.exponent2));
          asmKey.push(new Uint8Array(key.coefficient));
        }
        return asmKey;
      }
    }]);
    return RsaCrypto;
  }();
  RsaCrypto.RsaSsa = "RSASSA-PKCS1-v1_5";
  RsaCrypto.RsaPss = "RSA-PSS";
  RsaCrypto.RsaOaep = "RSA-OAEP";
  RsaCrypto.privateUsages = ["sign", "decrypt", "unwrapKey"];
  RsaCrypto.publicUsages = ["verify", "encrypt", "wrapKey"];
  var ShaCrypto = function () {
    function ShaCrypto() {
      _classCallCheck(this, ShaCrypto);
    }
    _createClass(ShaCrypto, null, [{
      key: "getDigest",
      value: function getDigest(name) {
        switch (name) {
          case "SHA-1":
            return new asmCrypto__namespace.Sha1();
          case "SHA-256":
            return new asmCrypto__namespace.Sha256();
          case "SHA-512":
            return new asmCrypto__namespace.Sha512();
          default:
            throw new AlgorithmError("keyAlgorithm.hash: Is not recognized");
        }
      }
    }, {
      key: "digest",
      value: function digest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee65() {
          var mech, result;
          return _regeneratorRuntime().wrap(function _callee65$(_context65) {
            while (1) switch (_context65.prev = _context65.next) {
              case 0:
                mech = this.getDigest(algorithm.name);
                result = mech.process(BufferSourceConverter.toUint8Array(data)).finish().result;
                return _context65.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 3:
              case "end":
                return _context65.stop();
            }
          }, _callee65, this);
        }));
      }
    }]);
    return ShaCrypto;
  }();
  var RsaOaepProvider = function (_RsaOaepProvider$) {
    _inherits(RsaOaepProvider, _RsaOaepProvider$);
    function RsaOaepProvider() {
      _classCallCheck(this, RsaOaepProvider);
      return _callSuper(this, RsaOaepProvider, arguments);
    }
    _createClass(RsaOaepProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee66() {
          return _regeneratorRuntime().wrap(function _callee66$(_context66) {
            while (1) switch (_context66.prev = _context66.next) {
              case 0:
                return _context66.abrupt("return", RsaCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context66.stop();
            }
          }, _callee66);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee67() {
          return _regeneratorRuntime().wrap(function _callee67$(_context67) {
            while (1) switch (_context67.prev = _context67.next) {
              case 0:
                return _context67.abrupt("return", RsaCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context67.stop();
            }
          }, _callee67);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee68() {
          return _regeneratorRuntime().wrap(function _callee68$(_context68) {
            while (1) switch (_context68.prev = _context68.next) {
              case 0:
                return _context68.abrupt("return", RsaCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context68.stop();
            }
          }, _callee68);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee69() {
          return _regeneratorRuntime().wrap(function _callee69$(_context69) {
            while (1) switch (_context69.prev = _context69.next) {
              case 0:
                return _context69.abrupt("return", this.cipher(algorithm, key, data));
              case 1:
              case "end":
                return _context69.stop();
            }
          }, _callee69, this);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee70() {
          return _regeneratorRuntime().wrap(function _callee70$(_context70) {
            while (1) switch (_context70.prev = _context70.next) {
              case 0:
                return _context70.abrupt("return", this.cipher(algorithm, key, data));
              case 1:
              case "end":
                return _context70.stop();
            }
          }, _callee70, this);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(RsaOaepProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        RsaCrypto.checkCryptoKey(key);
      }
    }, {
      key: "cipher",
      value: function cipher(algorithm, key, data) {
        var digest = ShaCrypto.getDigest(key.algorithm.hash.name);
        var label;
        if (algorithm.label) {
          label = BufferSourceConverter.toUint8Array(algorithm.label);
        }
        var cipher = new asmCrypto__namespace.RSA_OAEP(key.data, digest, label);
        var res;
        var u8Data = BufferSourceConverter.toUint8Array(data);
        if (key.type === "public") {
          res = cipher.encrypt(u8Data);
        } else {
          res = cipher.decrypt(u8Data);
        }
        return BufferSourceConverter.toArrayBuffer(res);
      }
    }]);
    return RsaOaepProvider;
  }(RsaOaepProvider$1);
  var RsaPssProvider = function (_RsaPssProvider$) {
    _inherits(RsaPssProvider, _RsaPssProvider$);
    function RsaPssProvider() {
      _classCallCheck(this, RsaPssProvider);
      return _callSuper(this, RsaPssProvider, arguments);
    }
    _createClass(RsaPssProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee71() {
          return _regeneratorRuntime().wrap(function _callee71$(_context71) {
            while (1) switch (_context71.prev = _context71.next) {
              case 0:
                return _context71.abrupt("return", RsaCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context71.stop();
            }
          }, _callee71);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee72() {
          return _regeneratorRuntime().wrap(function _callee72$(_context72) {
            while (1) switch (_context72.prev = _context72.next) {
              case 0:
                return _context72.abrupt("return", RsaCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context72.stop();
            }
          }, _callee72);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee73() {
          return _regeneratorRuntime().wrap(function _callee73$(_context73) {
            while (1) switch (_context73.prev = _context73.next) {
              case 0:
                return _context73.abrupt("return", RsaCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context73.stop();
            }
          }, _callee73);
        }));
      }
    }, {
      key: "onSign",
      value: function onSign(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee74() {
          var rsa, result;
          return _regeneratorRuntime().wrap(function _callee74$(_context74) {
            while (1) switch (_context74.prev = _context74.next) {
              case 0:
                rsa = new asmCrypto__namespace.RSA_PSS(key.data, ShaCrypto.getDigest(key.algorithm.hash.name), algorithm.saltLength);
                result = rsa.sign(BufferSourceConverter.toUint8Array(data));
                return _context74.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 3:
              case "end":
                return _context74.stop();
            }
          }, _callee74);
        }));
      }
    }, {
      key: "onVerify",
      value: function onVerify(algorithm, key, signature, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee75() {
          var rsa;
          return _regeneratorRuntime().wrap(function _callee75$(_context75) {
            while (1) switch (_context75.prev = _context75.next) {
              case 0:
                rsa = new asmCrypto__namespace.RSA_PSS(key.data, ShaCrypto.getDigest(key.algorithm.hash.name), algorithm.saltLength);
                _context75.prev = 1;
                rsa.verify(BufferSourceConverter.toUint8Array(signature), BufferSourceConverter.toUint8Array(data));
                _context75.next = 8;
                break;
              case 5:
                _context75.prev = 5;
                _context75.t0 = _context75["catch"](1);
                return _context75.abrupt("return", false);
              case 8:
                return _context75.abrupt("return", true);
              case 9:
              case "end":
                return _context75.stop();
            }
          }, _callee75, null, [[1, 5]]);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(RsaPssProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        RsaCrypto.checkCryptoKey(key);
      }
    }]);
    return RsaPssProvider;
  }(RsaPssProvider$1);
  var RsaSsaProvider = function (_RsaSsaProvider$) {
    _inherits(RsaSsaProvider, _RsaSsaProvider$);
    function RsaSsaProvider() {
      _classCallCheck(this, RsaSsaProvider);
      return _callSuper(this, RsaSsaProvider, arguments);
    }
    _createClass(RsaSsaProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee76() {
          return _regeneratorRuntime().wrap(function _callee76$(_context76) {
            while (1) switch (_context76.prev = _context76.next) {
              case 0:
                return _context76.abrupt("return", RsaCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context76.stop();
            }
          }, _callee76);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee77() {
          return _regeneratorRuntime().wrap(function _callee77$(_context77) {
            while (1) switch (_context77.prev = _context77.next) {
              case 0:
                return _context77.abrupt("return", RsaCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context77.stop();
            }
          }, _callee77);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee78() {
          return _regeneratorRuntime().wrap(function _callee78$(_context78) {
            while (1) switch (_context78.prev = _context78.next) {
              case 0:
                return _context78.abrupt("return", RsaCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context78.stop();
            }
          }, _callee78);
        }));
      }
    }, {
      key: "onSign",
      value: function onSign(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee79() {
          var rsa, result;
          return _regeneratorRuntime().wrap(function _callee79$(_context79) {
            while (1) switch (_context79.prev = _context79.next) {
              case 0:
                rsa = new asmCrypto__namespace.RSA_PKCS1_v1_5(key.data, ShaCrypto.getDigest(key.algorithm.hash.name));
                result = rsa.sign(BufferSourceConverter.toUint8Array(data));
                return _context79.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 3:
              case "end":
                return _context79.stop();
            }
          }, _callee79);
        }));
      }
    }, {
      key: "onVerify",
      value: function onVerify(algorithm, key, signature, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee80() {
          var rsa;
          return _regeneratorRuntime().wrap(function _callee80$(_context80) {
            while (1) switch (_context80.prev = _context80.next) {
              case 0:
                rsa = new asmCrypto__namespace.RSA_PKCS1_v1_5(key.data, ShaCrypto.getDigest(key.algorithm.hash.name));
                _context80.prev = 1;
                rsa.verify(BufferSourceConverter.toUint8Array(signature), BufferSourceConverter.toUint8Array(data));
                _context80.next = 8;
                break;
              case 5:
                _context80.prev = 5;
                _context80.t0 = _context80["catch"](1);
                return _context80.abrupt("return", false);
              case 8:
                return _context80.abrupt("return", true);
              case 9:
              case "end":
                return _context80.stop();
            }
          }, _callee80, null, [[1, 5]]);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(RsaSsaProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        RsaCrypto.checkCryptoKey(key);
      }
    }]);
    return RsaSsaProvider;
  }(RsaSsaProvider$1);
  var RsaEsProvider = function (_ProviderCrypto8) {
    _inherits(RsaEsProvider, _ProviderCrypto8);
    function RsaEsProvider() {
      var _this85;
      _classCallCheck(this, RsaEsProvider);
      _this85 = _callSuper(this, RsaEsProvider, arguments);
      _this85.name = "RSAES-PKCS1-v1_5";
      _this85.usages = {
        publicKey: ["encrypt", "wrapKey"],
        privateKey: ["decrypt", "unwrapKey"]
      };
      _this85.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
      return _this85;
    }
    _createClass(RsaEsProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee81() {
          return _regeneratorRuntime().wrap(function _callee81$(_context81) {
            while (1) switch (_context81.prev = _context81.next) {
              case 0:
                return _context81.abrupt("return", RsaCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context81.stop();
            }
          }, _callee81);
        }));
      }
    }, {
      key: "checkGenerateKeyParams",
      value: function checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "publicExponent");
        if (!(algorithm.publicExponent && algorithm.publicExponent instanceof Uint8Array)) {
          throw new TypeError("publicExponent: Missing or not a Uint8Array");
        }
        var publicExponent = Convert.ToBase64(algorithm.publicExponent);
        if (!(publicExponent === "Aw==" || publicExponent === "AQAB")) {
          throw new TypeError("publicExponent: Must be [3] or [1,0,1]");
        }
        this.checkRequiredProperty(algorithm, "modulusLength");
        switch (algorithm.modulusLength) {
          case 1024:
          case 2048:
          case 4096:
            break;
          default:
            throw new TypeError("modulusLength: Must be 1024, 2048, or 4096");
        }
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee82() {
          var EM, k, offset;
          return _regeneratorRuntime().wrap(function _callee82$(_context82) {
            while (1) switch (_context82.prev = _context82.next) {
              case 0:
                EM = new asmCrypto__namespace.RSA(key.data).decrypt(new asmCrypto__namespace.BigNumber(BufferSourceConverter.toUint8Array(data))).result;
                k = key.algorithm.modulusLength >> 3;
                if (!(data.byteLength !== k)) {
                  _context82.next = 4;
                  break;
                }
                throw new CryptoError("Decryption error. Encrypted message size doesn't match to key length");
              case 4:
                offset = 0;
                if (!(EM[offset++] || EM[offset++] !== 2)) {
                  _context82.next = 7;
                  break;
                }
                throw new CryptoError("Decryption error");
              case 7:
                if (!(EM[offset++] === 0)) {
                  _context82.next = 9;
                  break;
                }
                return _context82.abrupt("break", 10);
              case 9:
                if (offset < EM.length) {
                  _context82.next = 7;
                  break;
                }
              case 10:
                if (!(offset < 11)) {
                  _context82.next = 12;
                  break;
                }
                throw new CryptoError("Decryption error. PS is less than 8 octets.");
              case 12:
                if (!(offset === EM.length)) {
                  _context82.next = 14;
                  break;
                }
                throw new CryptoError("Decryption error. There is no octet with hexadecimal value 0x00 to separate PS from M");
              case 14:
                return _context82.abrupt("return", EM.buffer.slice(offset));
              case 15:
              case "end":
                return _context82.stop();
            }
          }, _callee82);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee83() {
          var k, psLen, PS, EM, result;
          return _regeneratorRuntime().wrap(function _callee83$(_context83) {
            while (1) switch (_context83.prev = _context83.next) {
              case 0:
                k = key.algorithm.modulusLength >> 3;
                if (!(data.byteLength > k - 11)) {
                  _context83.next = 3;
                  break;
                }
                throw new CryptoError("Message too long");
              case 3:
                psLen = k - data.byteLength - 3;
                PS = RsaCrypto.randomNonZeroValues(new Uint8Array(psLen));
                EM = new Uint8Array(k);
                EM[0] = 0;
                EM[1] = 2;
                EM.set(PS, 2);
                EM[2 + psLen] = 0;
                EM.set(new Uint8Array(data), 3 + psLen);
                result = new asmCrypto__namespace.RSA(key.data).encrypt(new asmCrypto__namespace.BigNumber(EM)).result;
                return _context83.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 13:
              case "end":
                return _context83.stop();
            }
          }, _callee83);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee84() {
          return _regeneratorRuntime().wrap(function _callee84$(_context84) {
            while (1) switch (_context84.prev = _context84.next) {
              case 0:
                return _context84.abrupt("return", RsaCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context84.stop();
            }
          }, _callee84);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee85() {
          var key;
          return _regeneratorRuntime().wrap(function _callee85$(_context85) {
            while (1) switch (_context85.prev = _context85.next) {
              case 0:
                _context85.next = 2;
                return RsaCrypto.importKey(format, keyData, Object.assign(Object.assign({}, algorithm), {
                  name: this.name
                }), extractable, keyUsages);
              case 2:
                key = _context85.sent;
                return _context85.abrupt("return", key);
              case 4:
              case "end":
                return _context85.stop();
            }
          }, _callee85, this);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(RsaEsProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        RsaCrypto.checkCryptoKey(key);
      }
    }]);
    return RsaEsProvider;
  }(ProviderCrypto);
  var namedOIDs = {
    "1.2.840.10045.3.1.7": "P-256",
    "P-256": "1.2.840.10045.3.1.7",
    "1.3.132.0.34": "P-384",
    "P-384": "1.3.132.0.34",
    "1.3.132.0.35": "P-521",
    "P-521": "1.3.132.0.35",
    "1.3.132.0.10": "K-256",
    "K-256": "1.3.132.0.10",
    "1.3.36.3.3.2.8.1.1.7": "brainpoolP256r1",
    "brainpoolP256r1": "1.3.36.3.3.2.8.1.1.7",
    "1.3.36.3.3.2.8.1.1.11": "brainpoolP384r1",
    "brainpoolP384r1": "1.3.36.3.3.2.8.1.1.11",
    "1.3.36.3.3.2.8.1.1.13": "brainpoolP512r1",
    "brainpoolP512r1": "1.3.36.3.3.2.8.1.1.13"
  };
  function getOidByNamedCurve$1(namedCurve) {
    var oid = namedOIDs[namedCurve];
    if (!oid) {
      throw new OperationError("Cannot convert WebCrypto named curve '".concat(namedCurve, "' to OID"));
    }
    return oid;
  }
  var EcCryptoKey = function (_CryptoKey3) {
    _inherits(EcCryptoKey, _CryptoKey3);
    function EcCryptoKey(algorithm, extractable, type, usages, data) {
      var _this86;
      _classCallCheck(this, EcCryptoKey);
      _this86 = _callSuper(this, EcCryptoKey, [algorithm, extractable, type, usages]);
      _this86.data = data;
      return _this86;
    }
    return _createClass(EcCryptoKey);
  }(CryptoKey);
  var EcCrypto = function () {
    function EcCrypto() {
      _classCallCheck(this, EcCrypto);
    }
    _createClass(EcCrypto, null, [{
      key: "checkLib",
      value: function checkLib() {
        if (typeof elliptic__namespace === "undefined") {
          throw new OperationError("Cannot implement EC mechanism. Add 'https://peculiarventures.github.io/pv-webcrypto-tests/src/elliptic.js' script to your project");
        }
      }
    }, {
      key: "generateKey",
      value: function generateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee86() {
          var _this87 = this;
          var key, ecKey, prvKey, pubKey;
          return _regeneratorRuntime().wrap(function _callee86$(_context86) {
            while (1) switch (_context86.prev = _context86.next) {
              case 0:
                this.checkLib();
                key = this.initEcKey(algorithm.namedCurve);
                ecKey = key.genKeyPair();
                ecKey.getPublic();
                prvKey = new EcCryptoKey(Object.assign({}, algorithm), extractable, "private", keyUsages.filter(function (usage) {
                  return ~_this87.privateUsages.indexOf(usage);
                }), ecKey);
                pubKey = new EcCryptoKey(Object.assign({}, algorithm), true, "public", keyUsages.filter(function (usage) {
                  return ~_this87.publicUsages.indexOf(usage);
                }), ecKey);
                return _context86.abrupt("return", {
                  privateKey: prvKey,
                  publicKey: pubKey
                });
              case 7:
              case "end":
                return _context86.stop();
            }
          }, _callee86, this);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key) {
        if (!(key instanceof EcCryptoKey)) {
          throw new TypeError("key: Is not EcCryptoKey");
        }
      }
    }, {
      key: "concat",
      value: function concat() {
        for (var _len29 = arguments.length, buf = new Array(_len29), _key32 = 0; _key32 < _len29; _key32++) {
          buf[_key32] = arguments[_key32];
        }
        var res = new Uint8Array(buf.map(function (item) {
          return item.length;
        }).reduce(function (prev, cur) {
          return prev + cur;
        }));
        var offset = 0;
        buf.forEach(function (item) {
          for (var i = 0; i < item.length; i++) {
            res[offset + i] = item[i];
          }
          offset += item.length;
        });
        return res;
      }
    }, {
      key: "exportKey",
      value: function exportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee87() {
          return _regeneratorRuntime().wrap(function _callee87$(_context87) {
            while (1) switch (_context87.prev = _context87.next) {
              case 0:
                this.checkLib();
                _context87.t0 = format;
                _context87.next = _context87.t0 === "pkcs8" ? 4 : _context87.t0 === "spki" ? 5 : _context87.t0 === "jwk" ? 6 : _context87.t0 === "raw" ? 7 : 8;
                break;
              case 4:
                return _context87.abrupt("return", this.exportPkcs8Key(key));
              case 5:
                return _context87.abrupt("return", this.exportSpkiKey(key));
              case 6:
                return _context87.abrupt("return", this.exportJwkKey(key));
              case 7:
                return _context87.abrupt("return", new Uint8Array(key.data.getPublic("der")).buffer);
              case 8:
                throw new OperationError("format: Must be 'jwk', 'raw, 'pkcs8' or 'spki'");
              case 9:
              case "end":
                return _context87.stop();
            }
          }, _callee87, this);
        }));
      }
    }, {
      key: "importKey",
      value: function importKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee88() {
          var ecKey, key;
          return _regeneratorRuntime().wrap(function _callee88$(_context88) {
            while (1) switch (_context88.prev = _context88.next) {
              case 0:
                this.checkLib();
                _context88.t0 = format;
                _context88.next = _context88.t0 === "pkcs8" ? 4 : _context88.t0 === "spki" ? 6 : _context88.t0 === "raw" ? 8 : _context88.t0 === "jwk" ? 10 : 12;
                break;
              case 4:
                ecKey = this.importPkcs8Key(keyData, algorithm.namedCurve);
                return _context88.abrupt("break", 13);
              case 6:
                ecKey = this.importSpkiKey(keyData, algorithm.namedCurve);
                return _context88.abrupt("break", 13);
              case 8:
                ecKey = this.importEcKey(new index$1.EcPublicKey(keyData), algorithm.namedCurve);
                return _context88.abrupt("break", 13);
              case 10:
                ecKey = this.importJwkKey(keyData);
                return _context88.abrupt("break", 13);
              case 12:
                throw new OperationError("format: Must be 'jwk', 'raw', 'pkcs8' or 'spki'");
              case 13:
                key = new EcCryptoKey(Object.assign({}, algorithm), extractable, ecKey.priv ? "private" : "public", keyUsages, ecKey);
                return _context88.abrupt("return", key);
              case 15:
              case "end":
                return _context88.stop();
            }
          }, _callee88, this);
        }));
      }
    }, {
      key: "getNamedCurve",
      value: function getNamedCurve(wcNamedCurve) {
        var crv = wcNamedCurve.toUpperCase();
        var res = "";
        if (["P-256", "P-384", "P-521"].indexOf(crv) > -1) {
          res = crv.replace("-", "").toLowerCase();
        } else if (crv === "K-256") {
          res = "secp256k1";
        } else if (["brainpoolP256r1", "brainpoolP384r1", "brainpoolP512r1"].includes(wcNamedCurve)) {
          res = wcNamedCurve;
        } else {
          throw new OperationError("Unsupported named curve '".concat(wcNamedCurve, "'"));
        }
        return res;
      }
    }, {
      key: "initEcKey",
      value: function initEcKey(namedCurve) {
        return elliptic__namespace.ec(this.getNamedCurve(namedCurve));
      }
    }, {
      key: "exportPkcs8Key",
      value: function exportPkcs8Key(key) {
        var keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = this.ASN_ALGORITHM;
        keyInfo.privateKeyAlgorithm.parameters = AsnConvert.serialize(new index$1.ObjectIdentifier(getOidByNamedCurve$1(key.algorithm.namedCurve)));
        keyInfo.privateKey = AsnConvert.serialize(this.exportEcKey(key));
        return AsnConvert.serialize(keyInfo);
      }
    }, {
      key: "importPkcs8Key",
      value: function importPkcs8Key(data, namedCurve) {
        var keyInfo = AsnConvert.parse(data, index$1.PrivateKeyInfo);
        var privateKey = AsnConvert.parse(keyInfo.privateKey, index$1.EcPrivateKey);
        return this.importEcKey(privateKey, namedCurve);
      }
    }, {
      key: "importSpkiKey",
      value: function importSpkiKey(data, namedCurve) {
        var keyInfo = AsnConvert.parse(data, index$1.PublicKeyInfo);
        var publicKey = new index$1.EcPublicKey(keyInfo.publicKey);
        return this.importEcKey(publicKey, namedCurve);
      }
    }, {
      key: "exportSpkiKey",
      value: function exportSpkiKey(key) {
        var publicKey = new index$1.EcPublicKey(new Uint8Array(key.data.getPublic("der")).buffer);
        var keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = this.ASN_ALGORITHM;
        keyInfo.publicKeyAlgorithm.parameters = AsnConvert.serialize(new index$1.ObjectIdentifier(getOidByNamedCurve$1(key.algorithm.namedCurve)));
        keyInfo.publicKey = publicKey.value;
        return AsnConvert.serialize(keyInfo);
      }
    }, {
      key: "importJwkKey",
      value: function importJwkKey(data) {
        var key;
        if (data.d) {
          key = JsonParser.fromJSON(data, {
            targetSchema: index$1.EcPrivateKey
          });
        } else {
          key = JsonParser.fromJSON(data, {
            targetSchema: index$1.EcPublicKey
          });
        }
        return this.importEcKey(key, data.crv);
      }
    }, {
      key: "exportJwkKey",
      value: function exportJwkKey(key) {
        var asnKey = this.exportEcKey(key);
        var jwk = JsonSerializer.toJSON(asnKey);
        jwk.ext = true;
        jwk.key_ops = key.usages;
        jwk.crv = key.algorithm.namedCurve;
        jwk.kty = "EC";
        return jwk;
      }
    }, {
      key: "exportEcKey",
      value: function exportEcKey(ecKey) {
        if (ecKey.type === "private") {
          var privateKey = new index$1.EcPrivateKey();
          var point = new Uint8Array(ecKey.data.getPrivate("der").toArray());
          var pointPad = new Uint8Array(this.getPointSize(ecKey.algorithm.namedCurve) - point.length);
          privateKey.privateKey = concat(pointPad, point);
          privateKey.publicKey = new Uint8Array(ecKey.data.getPublic("der"));
          return privateKey;
        } else if (ecKey.data.pub) {
          return new index$1.EcPublicKey(new Uint8Array(ecKey.data.getPublic("der")).buffer);
        } else {
          throw new Error("Cannot get private or public key");
        }
      }
    }, {
      key: "importEcKey",
      value: function importEcKey(key, namedCurve) {
        var ecKey = this.initEcKey(namedCurve);
        if (key instanceof index$1.EcPublicKey) {
          return ecKey.keyFromPublic(new Uint8Array(key.value));
        }
        return ecKey.keyFromPrivate(new Uint8Array(key.privateKey));
      }
    }, {
      key: "getPointSize",
      value: function getPointSize(namedCurve) {
        switch (namedCurve) {
          case "P-256":
          case "K-256":
            return 32;
          case "P-384":
            return 48;
          case "P-521":
            return 66;
        }
        throw new Error("namedCurve: Is not recognized");
      }
    }]);
    return EcCrypto;
  }();
  EcCrypto.privateUsages = ["sign", "deriveKey", "deriveBits"];
  EcCrypto.publicUsages = ["verify"];
  EcCrypto.ASN_ALGORITHM = "1.2.840.10045.2.1";
  var EcdhProvider = function (_EcdhProvider$2) {
    _inherits(EcdhProvider, _EcdhProvider$2);
    function EcdhProvider() {
      var _this88;
      _classCallCheck(this, EcdhProvider);
      _this88 = _callSuper(this, EcdhProvider, arguments);
      _this88.namedCurves = ["P-256", "P-384", "P-521", "K-256", "brainpoolP256r1", "brainpoolP384r1", "brainpoolP512r1"];
      return _this88;
    }
    _createClass(EcdhProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee89() {
          return _regeneratorRuntime().wrap(function _callee89$(_context89) {
            while (1) switch (_context89.prev = _context89.next) {
              case 0:
                return _context89.abrupt("return", EcCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context89.stop();
            }
          }, _callee89);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee90() {
          return _regeneratorRuntime().wrap(function _callee90$(_context90) {
            while (1) switch (_context90.prev = _context90.next) {
              case 0:
                return _context90.abrupt("return", EcCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context90.stop();
            }
          }, _callee90);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee91() {
          return _regeneratorRuntime().wrap(function _callee91$(_context91) {
            while (1) switch (_context91.prev = _context91.next) {
              case 0:
                return _context91.abrupt("return", EcCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context91.stop();
            }
          }, _callee91);
        }));
      }
    }, {
      key: "onDeriveBits",
      value: function onDeriveBits(algorithm, baseKey, length) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee92() {
          var shared, array, len, buf;
          return _regeneratorRuntime().wrap(function _callee92$(_context92) {
            while (1) switch (_context92.prev = _context92.next) {
              case 0:
                EcCrypto.checkLib();
                shared = baseKey.data.derive(algorithm.public.data.getPublic());
                array = new Uint8Array(shared.toArray());
                len = array.length;
                len = len > 32 ? len > 48 ? 66 : 48 : 32;
                if (array.length < len) {
                  array = EcCrypto.concat(new Uint8Array(len - array.length), array);
                }
                buf = array.slice(0, length / 8).buffer;
                return _context92.abrupt("return", buf);
              case 8:
              case "end":
                return _context92.stop();
            }
          }, _callee92);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(EcdhProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        EcCrypto.checkCryptoKey(key);
      }
    }]);
    return EcdhProvider;
  }(EcdhProvider$1);
  function b2a(buffer) {
    var buf = new Uint8Array(buffer);
    var res = [];
    for (var i = 0; i < buf.length; i++) {
      res.push(buf[i]);
    }
    return res;
  }
  var EcdsaProvider = function (_EcdsaProvider$) {
    _inherits(EcdsaProvider, _EcdsaProvider$);
    function EcdsaProvider() {
      var _this89;
      _classCallCheck(this, EcdsaProvider);
      _this89 = _callSuper(this, EcdsaProvider, arguments);
      _this89.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512", "SHA3-256", "SHA3-384", "SHA3-512"];
      _this89.namedCurves = ["P-256", "P-384", "P-521", "K-256", "brainpoolP256r1", "brainpoolP384r1", "brainpoolP512r1"];
      return _this89;
    }
    _createClass(EcdsaProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee93() {
          return _regeneratorRuntime().wrap(function _callee93$(_context93) {
            while (1) switch (_context93.prev = _context93.next) {
              case 0:
                return _context93.abrupt("return", EcCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context93.stop();
            }
          }, _callee93);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee94() {
          return _regeneratorRuntime().wrap(function _callee94$(_context94) {
            while (1) switch (_context94.prev = _context94.next) {
              case 0:
                return _context94.abrupt("return", EcCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context94.stop();
            }
          }, _callee94);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee95() {
          return _regeneratorRuntime().wrap(function _callee95$(_context95) {
            while (1) switch (_context95.prev = _context95.next) {
              case 0:
                return _context95.abrupt("return", EcCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context95.stop();
            }
          }, _callee95);
        }));
      }
    }, {
      key: "onSign",
      value: function onSign(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee96() {
          var crypto, hash, array, signature, asnSignature;
          return _regeneratorRuntime().wrap(function _callee96$(_context96) {
            while (1) switch (_context96.prev = _context96.next) {
              case 0:
                EcCrypto.checkLib();
                crypto = new Crypto();
                _context96.next = 4;
                return crypto.subtle.digest(algorithm.hash, data);
              case 4:
                hash = _context96.sent;
                array = b2a(hash);
                _context96.next = 8;
                return key.data.sign(array);
              case 8:
                signature = _context96.sent;
                asnSignature = new index$1.EcDsaSignature();
                asnSignature.r = new Uint8Array(signature.r.toArray()).buffer;
                asnSignature.s = new Uint8Array(signature.s.toArray()).buffer;
                return _context96.abrupt("return", asnSignature.toWebCryptoSignature());
              case 13:
              case "end":
                return _context96.stop();
            }
          }, _callee96);
        }));
      }
    }, {
      key: "onVerify",
      value: function onVerify(algorithm, key, signature, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee97() {
          var crypto, sig, hashedData, array;
          return _regeneratorRuntime().wrap(function _callee97$(_context97) {
            while (1) switch (_context97.prev = _context97.next) {
              case 0:
                EcCrypto.checkLib();
                crypto = new Crypto();
                sig = {
                  r: new Uint8Array(signature.slice(0, signature.byteLength / 2)),
                  s: new Uint8Array(signature.slice(signature.byteLength / 2))
                };
                _context97.next = 5;
                return crypto.subtle.digest(algorithm.hash, data);
              case 5:
                hashedData = _context97.sent;
                array = b2a(hashedData);
                return _context97.abrupt("return", key.data.verify(array, sig));
              case 8:
              case "end":
                return _context97.stop();
            }
          }, _callee97);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(EcdsaProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        EcCrypto.checkCryptoKey(key);
      }
    }]);
    return EcdsaProvider;
  }(EcdsaProvider$1);
  var edOIDs = _defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty({}, index$1.idEd448, "Ed448"), "ed448", index$1.idEd448), index$1.idX448, "X448"), "x448", index$1.idX448), index$1.idEd25519, "Ed25519"), "ed25519", index$1.idEd25519), index$1.idX25519, "X25519"), "x25519", index$1.idX25519);
  function getOidByNamedCurve(namedCurve) {
    var oid = edOIDs[namedCurve.toLowerCase()];
    if (!oid) {
      throw new OperationError("Cannot convert WebCrypto named curve '".concat(namedCurve, "' to OID"));
    }
    return oid;
  }
  var EdPrivateKey = function (_CryptoKey4) {
    _inherits(EdPrivateKey, _CryptoKey4);
    function EdPrivateKey(algorithm, extractable, usages, data) {
      var _this90;
      _classCallCheck(this, EdPrivateKey);
      _this90 = _callSuper(this, EdPrivateKey, [algorithm, extractable, "private", usages]);
      _this90.data = data;
      return _this90;
    }
    _createClass(EdPrivateKey, [{
      key: "toJSON",
      value: function toJSON() {
        var json = {
          kty: "OKP",
          crv: this.algorithm.namedCurve,
          key_ops: this.usages,
          ext: this.extractable
        };
        return Object.assign(json, {
          d: Convert.ToBase64Url(Convert.FromHex(/^ed/i.test(json.crv) ? this.data.getSecret("hex") : this.data.getPrivate("hex")))
        });
      }
    }, {
      key: "fromJSON",
      value: function fromJSON(json) {
        if (!json.d) {
          throw new OperationError("Cannot get private data from JWK. Property 'd' is required");
        }
        if (!json.crv) {
          throw new OperationError("Cannot get named curve from JWK. Property 'crv' is required");
        }
        var hexPrivateKey = Convert.ToHex(Convert.FromBase64Url(json.d));
        if (/^ed/i.test(json.crv)) {
          var eddsa = new elliptic__namespace.eddsa("ed25519");
          this.data = eddsa.keyFromSecret(hexPrivateKey);
        } else {
          var ecdhEs = elliptic__namespace.ec(json.crv.replace(/^x/i, "curve"));
          this.data = ecdhEs.keyFromPrivate(hexPrivateKey, "hex");
        }
        return this;
      }
    }]);
    return EdPrivateKey;
  }(CryptoKey);
  var EdPublicKey = function (_CryptoKey5) {
    _inherits(EdPublicKey, _CryptoKey5);
    function EdPublicKey(algorithm, extractable, usages, data) {
      var _this91;
      _classCallCheck(this, EdPublicKey);
      _this91 = _callSuper(this, EdPublicKey, [algorithm, extractable, "public", usages]);
      _this91.data = data;
      return _this91;
    }
    _createClass(EdPublicKey, [{
      key: "toJSON",
      value: function toJSON() {
        var json = {
          kty: "OKP",
          crv: this.algorithm.namedCurve,
          key_ops: this.usages,
          ext: this.extractable
        };
        return Object.assign(json, {
          x: Convert.ToBase64Url(Convert.FromHex(this.data.getPublic("hex")))
        });
      }
    }, {
      key: "fromJSON",
      value: function fromJSON(json) {
        if (!json.crv) {
          throw new OperationError("Cannot get named curve from JWK. Property 'crv' is required");
        }
        if (!json.x) {
          throw new OperationError("Cannot get property from JWK. Property 'x' is required");
        }
        var hexPublicKey = Convert.ToHex(Convert.FromBase64Url(json.x));
        if (/^ed/i.test(json.crv)) {
          var eddsa = new elliptic__namespace.eddsa(json.crv.toLowerCase());
          this.data = eddsa.keyFromPublic(hexPublicKey, "hex");
        } else {
          var ecdhEs = elliptic__namespace.ec(json.crv.replace(/^x/i, "curve"));
          this.data = ecdhEs.keyFromPublic(hexPublicKey, "hex");
        }
        return this;
      }
    }]);
    return EdPublicKey;
  }(CryptoKey);
  var EdCrypto = function () {
    function EdCrypto() {
      _classCallCheck(this, EdCrypto);
    }
    _createClass(EdCrypto, null, [{
      key: "checkLib",
      value: function checkLib() {
        if (typeof elliptic__namespace === "undefined") {
          throw new OperationError("Cannot implement EC mechanism. Add 'https://peculiarventures.github.io/pv-webcrypto-tests/src/elliptic.js' script to your project");
        }
      }
    }, {
      key: "concat",
      value: function concat() {
        for (var _len30 = arguments.length, buf = new Array(_len30), _key33 = 0; _key33 < _len30; _key33++) {
          buf[_key33] = arguments[_key33];
        }
        var res = new Uint8Array(buf.map(function (item) {
          return item.length;
        }).reduce(function (prev, cur) {
          return prev + cur;
        }));
        var offset = 0;
        buf.forEach(function (item) {
          for (var i = 0; i < item.length; i++) {
            res[offset + i] = item[i];
          }
          offset += item.length;
        });
        return res;
      }
    }, {
      key: "generateKey",
      value: function generateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee98() {
          var _this92 = this;
          var curve, edKey, raw, eddsa, prvKey, pubKey;
          return _regeneratorRuntime().wrap(function _callee98$(_context98) {
            while (1) switch (_context98.prev = _context98.next) {
              case 0:
                this.checkLib();
                curve = "ed25519";
                raw = exports.nativeCrypto.getRandomValues(new Uint8Array(32));
                eddsa = new elliptic__namespace.eddsa(curve);
                edKey = eddsa.keyFromSecret(raw);
                prvKey = new EdPrivateKey(algorithm, extractable, keyUsages.filter(function (usage) {
                  return _this92.privateKeyUsages.indexOf(usage) !== -1;
                }), edKey);
                pubKey = new EdPublicKey(algorithm, true, keyUsages.filter(function (usage) {
                  return _this92.publicKeyUsages.indexOf(usage) !== -1;
                }), edKey);
                return _context98.abrupt("return", {
                  privateKey: prvKey,
                  publicKey: pubKey
                });
              case 8:
              case "end":
                return _context98.stop();
            }
          }, _callee98, this);
        }));
      }
    }, {
      key: "sign",
      value: function sign(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee99() {
          var array, signature;
          return _regeneratorRuntime().wrap(function _callee99$(_context99) {
            while (1) switch (_context99.prev = _context99.next) {
              case 0:
                this.checkLib();
                array = b2a(data);
                signature = key.data.sign(array).toHex();
                return _context99.abrupt("return", Convert.FromHex(signature));
              case 4:
              case "end":
                return _context99.stop();
            }
          }, _callee99, this);
        }));
      }
    }, {
      key: "verify",
      value: function verify(algorithm, key, signature, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee100() {
          var array, ok;
          return _regeneratorRuntime().wrap(function _callee100$(_context100) {
            while (1) switch (_context100.prev = _context100.next) {
              case 0:
                this.checkLib();
                array = b2a(data);
                ok = key.data.verify(array, Convert.ToHex(signature));
                return _context100.abrupt("return", ok);
              case 4:
              case "end":
                return _context100.stop();
            }
          }, _callee100, this);
        }));
      }
    }, {
      key: "deriveBits",
      value: function deriveBits(algorithm, baseKey, length) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee101() {
          var key, ecdh, privateKey, publicHex, publicKey, shared, array, len, buf;
          return _regeneratorRuntime().wrap(function _callee101$(_context101) {
            while (1) switch (_context101.prev = _context101.next) {
              case 0:
                this.checkLib();
                key = new Uint8Array(Convert.FromHex(baseKey.data.getSecret("hex")));
                ecdh = new elliptic__namespace.ec("curve25519");
                privateKey = ecdh.keyFromPrivate(Convert.ToHex(key), "hex");
                publicHex = algorithm.public.data.getPublic("hex");
                new Uint8Array(Convert.FromHex(publicHex));
                publicKey = algorithm.public.data.getPublic();
                shared = privateKey.derive(publicKey);
                array = new Uint8Array(shared.toArray());
                len = array.length;
                len = len > 32 ? len > 48 ? 66 : 48 : 32;
                if (array.length < len) {
                  array = EdCrypto.concat(new Uint8Array(len - array.length), array);
                }
                buf = array.slice(0, length / 8).buffer;
                return _context101.abrupt("return", buf);
              case 14:
              case "end":
                return _context101.stop();
            }
          }, _callee101, this);
        }));
      }
    }, {
      key: "exportKey",
      value: function exportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee102() {
          var raw, keyInfo, _raw, _keyInfo;
          return _regeneratorRuntime().wrap(function _callee102$(_context102) {
            while (1) switch (_context102.prev = _context102.next) {
              case 0:
                this.checkLib();
                _context102.t0 = format.toLowerCase();
                _context102.next = _context102.t0 === "jwk" ? 4 : _context102.t0 === "pkcs8" ? 5 : _context102.t0 === "spki" ? 10 : _context102.t0 === "raw" ? 15 : 16;
                break;
              case 4:
                return _context102.abrupt("return", JsonSerializer.toJSON(key));
              case 5:
                raw = Convert.FromHex(key.data.getSecret("hex"));
                keyInfo = new index$1.PrivateKeyInfo();
                keyInfo.privateKeyAlgorithm.algorithm = getOidByNamedCurve(key.algorithm.namedCurve);
                keyInfo.privateKey = AsnConvert.serialize(new OctetString(raw));
                return _context102.abrupt("return", AsnConvert.serialize(keyInfo));
              case 10:
                _raw = Convert.FromHex(key.data.getPublic("hex"));
                _keyInfo = new index$1.PublicKeyInfo();
                _keyInfo.publicKeyAlgorithm.algorithm = getOidByNamedCurve(key.algorithm.namedCurve);
                _keyInfo.publicKey = _raw;
                return _context102.abrupt("return", AsnConvert.serialize(_keyInfo));
              case 15:
                return _context102.abrupt("return", Convert.FromHex(key.data.getPublic("hex")));
              case 16:
                throw new OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'");
              case 17:
              case "end":
                return _context102.stop();
            }
          }, _callee102, this);
        }));
      }
    }, {
      key: "importKey",
      value: function importKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee103() {
          var jwk, asnKey, keyInfo, _keyInfo2, _asnKey;
          return _regeneratorRuntime().wrap(function _callee103$(_context103) {
            while (1) switch (_context103.prev = _context103.next) {
              case 0:
                this.checkLib();
                _context103.t0 = format.toLowerCase();
                _context103.next = _context103.t0 === "jwk" ? 4 : _context103.t0 === "raw" ? 13 : _context103.t0 === "spki" ? 14 : _context103.t0 === "pkcs8" ? 16 : 19;
                break;
              case 4:
                jwk = keyData;
                if (!jwk.d) {
                  _context103.next = 10;
                  break;
                }
                asnKey = JsonParser.fromJSON(keyData, {
                  targetSchema: index$1.CurvePrivateKey
                });
                return _context103.abrupt("return", this.importPrivateKey(asnKey, algorithm, extractable, keyUsages));
              case 10:
                if (jwk.x) {
                  _context103.next = 12;
                  break;
                }
                throw new TypeError("keyData: Cannot get required 'x' field");
              case 12:
                return _context103.abrupt("return", this.importPublicKey(Convert.FromBase64Url(jwk.x), algorithm, extractable, keyUsages));
              case 13:
                return _context103.abrupt("return", this.importPublicKey(keyData, algorithm, extractable, keyUsages));
              case 14:
                keyInfo = AsnConvert.parse(new Uint8Array(keyData), index$1.PublicKeyInfo);
                return _context103.abrupt("return", this.importPublicKey(keyInfo.publicKey, algorithm, extractable, keyUsages));
              case 16:
                _keyInfo2 = AsnConvert.parse(new Uint8Array(keyData), index$1.PrivateKeyInfo);
                _asnKey = AsnConvert.parse(_keyInfo2.privateKey, index$1.CurvePrivateKey);
                return _context103.abrupt("return", this.importPrivateKey(_asnKey, algorithm, extractable, keyUsages));
              case 19:
                throw new OperationError("format: Must be 'jwk', 'raw', 'pkcs8' or 'spki'");
              case 20:
              case "end":
                return _context103.stop();
            }
          }, _callee103, this);
        }));
      }
    }, {
      key: "importPrivateKey",
      value: function importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        var key = new EdPrivateKey(Object.assign({}, algorithm), extractable, keyUsages, null);
        key.fromJSON({
          crv: algorithm.namedCurve,
          d: Convert.ToBase64Url(asnKey.d)
        });
        return key;
      }
    }, {
      key: "importPublicKey",
      value: function importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee104() {
          var key;
          return _regeneratorRuntime().wrap(function _callee104$(_context104) {
            while (1) switch (_context104.prev = _context104.next) {
              case 0:
                key = new EdPublicKey(Object.assign({}, algorithm), extractable, keyUsages, null);
                key.fromJSON({
                  crv: algorithm.namedCurve,
                  x: Convert.ToBase64Url(asnKey)
                });
                return _context104.abrupt("return", key);
              case 3:
              case "end":
                return _context104.stop();
            }
          }, _callee104);
        }));
      }
    }]);
    return EdCrypto;
  }();
  EdCrypto.publicKeyUsages = ["verify"];
  EdCrypto.privateKeyUsages = ["sign", "deriveKey", "deriveBits"];
  var EdDsaProvider = function (_EdDsaProvider$) {
    _inherits(EdDsaProvider, _EdDsaProvider$);
    function EdDsaProvider() {
      var _this93;
      _classCallCheck(this, EdDsaProvider);
      _this93 = _callSuper(this, EdDsaProvider, arguments);
      _this93.namedCurves = ["Ed25519"];
      return _this93;
    }
    _createClass(EdDsaProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee105() {
          var keys;
          return _regeneratorRuntime().wrap(function _callee105$(_context105) {
            while (1) switch (_context105.prev = _context105.next) {
              case 0:
                _context105.next = 2;
                return EdCrypto.generateKey({
                  name: this.name,
                  namedCurve: algorithm.namedCurve.replace(/^ed/i, "Ed")
                }, extractable, keyUsages);
              case 2:
                keys = _context105.sent;
                return _context105.abrupt("return", keys);
              case 4:
              case "end":
                return _context105.stop();
            }
          }, _callee105, this);
        }));
      }
    }, {
      key: "onSign",
      value: function onSign(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee106() {
          return _regeneratorRuntime().wrap(function _callee106$(_context106) {
            while (1) switch (_context106.prev = _context106.next) {
              case 0:
                return _context106.abrupt("return", EdCrypto.sign(algorithm, key, new Uint8Array(data)));
              case 1:
              case "end":
                return _context106.stop();
            }
          }, _callee106);
        }));
      }
    }, {
      key: "onVerify",
      value: function onVerify(algorithm, key, signature, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee107() {
          return _regeneratorRuntime().wrap(function _callee107$(_context107) {
            while (1) switch (_context107.prev = _context107.next) {
              case 0:
                return _context107.abrupt("return", EdCrypto.verify(algorithm, key, new Uint8Array(signature), new Uint8Array(data)));
              case 1:
              case "end":
                return _context107.stop();
            }
          }, _callee107);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee108() {
          return _regeneratorRuntime().wrap(function _callee108$(_context108) {
            while (1) switch (_context108.prev = _context108.next) {
              case 0:
                return _context108.abrupt("return", EdCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context108.stop();
            }
          }, _callee108);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee109() {
          var key;
          return _regeneratorRuntime().wrap(function _callee109$(_context109) {
            while (1) switch (_context109.prev = _context109.next) {
              case 0:
                _context109.next = 2;
                return EdCrypto.importKey(format, keyData, Object.assign(Object.assign({}, algorithm), {
                  name: this.name
                }), extractable, keyUsages);
              case 2:
                key = _context109.sent;
                return _context109.abrupt("return", key);
              case 4:
              case "end":
                return _context109.stop();
            }
          }, _callee109, this);
        }));
      }
    }]);
    return EdDsaProvider;
  }(EdDsaProvider$1);
  var EcdhEsProvider = function (_EcdhEsProvider$) {
    _inherits(EcdhEsProvider, _EcdhEsProvider$);
    function EcdhEsProvider() {
      var _this94;
      _classCallCheck(this, EcdhEsProvider);
      _this94 = _callSuper(this, EcdhEsProvider, arguments);
      _this94.namedCurves = ["X25519"];
      return _this94;
    }
    _createClass(EcdhEsProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee110() {
          var keys;
          return _regeneratorRuntime().wrap(function _callee110$(_context110) {
            while (1) switch (_context110.prev = _context110.next) {
              case 0:
                _context110.next = 2;
                return EdCrypto.generateKey({
                  name: this.name,
                  namedCurve: algorithm.namedCurve.replace(/^x/i, "X")
                }, extractable, keyUsages);
              case 2:
                keys = _context110.sent;
                return _context110.abrupt("return", keys);
              case 4:
              case "end":
                return _context110.stop();
            }
          }, _callee110, this);
        }));
      }
    }, {
      key: "onDeriveBits",
      value: function onDeriveBits(algorithm, baseKey, length) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee111() {
          var bits;
          return _regeneratorRuntime().wrap(function _callee111$(_context111) {
            while (1) switch (_context111.prev = _context111.next) {
              case 0:
                _context111.next = 2;
                return EdCrypto.deriveBits(Object.assign(Object.assign({}, algorithm), {
                  public: algorithm.public
                }), baseKey, length);
              case 2:
                bits = _context111.sent;
                return _context111.abrupt("return", bits);
              case 4:
              case "end":
                return _context111.stop();
            }
          }, _callee111);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee112() {
          return _regeneratorRuntime().wrap(function _callee112$(_context112) {
            while (1) switch (_context112.prev = _context112.next) {
              case 0:
                return _context112.abrupt("return", EdCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context112.stop();
            }
          }, _callee112);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee113() {
          var key;
          return _regeneratorRuntime().wrap(function _callee113$(_context113) {
            while (1) switch (_context113.prev = _context113.next) {
              case 0:
                _context113.next = 2;
                return EdCrypto.importKey(format, keyData, Object.assign(Object.assign({}, algorithm), {
                  name: this.name
                }), extractable, keyUsages);
              case 2:
                key = _context113.sent;
                return _context113.abrupt("return", key);
              case 4:
              case "end":
                return _context113.stop();
            }
          }, _callee113, this);
        }));
      }
    }]);
    return EcdhEsProvider;
  }(EcdhEsProvider$1);
  var Sha1Provider = function (_ProviderCrypto9) {
    _inherits(Sha1Provider, _ProviderCrypto9);
    function Sha1Provider() {
      var _this95;
      _classCallCheck(this, Sha1Provider);
      _this95 = _callSuper(this, Sha1Provider, arguments);
      _this95.name = "SHA-1";
      _this95.usages = [];
      return _this95;
    }
    _createClass(Sha1Provider, [{
      key: "onDigest",
      value: function onDigest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee114() {
          return _regeneratorRuntime().wrap(function _callee114$(_context114) {
            while (1) switch (_context114.prev = _context114.next) {
              case 0:
                return _context114.abrupt("return", ShaCrypto.digest(algorithm, data));
              case 1:
              case "end":
                return _context114.stop();
            }
          }, _callee114);
        }));
      }
    }]);
    return Sha1Provider;
  }(ProviderCrypto);
  var Sha256Provider = function (_Sha1Provider) {
    _inherits(Sha256Provider, _Sha1Provider);
    function Sha256Provider() {
      var _this96;
      _classCallCheck(this, Sha256Provider);
      _this96 = _callSuper(this, Sha256Provider, arguments);
      _this96.name = "SHA-256";
      return _this96;
    }
    return _createClass(Sha256Provider);
  }(Sha1Provider);
  var Sha512Provider = function (_Sha1Provider2) {
    _inherits(Sha512Provider, _Sha1Provider2);
    function Sha512Provider() {
      var _this97;
      _classCallCheck(this, Sha512Provider);
      _this97 = _callSuper(this, Sha512Provider, arguments);
      _this97.name = "SHA-512";
      return _this97;
    }
    return _createClass(Sha512Provider);
  }(Sha1Provider);
  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
  var sha3 = {};
  var binary = {};
  var int = {};
  (function (exports) {
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    function imulShim(a, b) {
      var ah = a >>> 16 & 0xffff,
        al = a & 0xffff;
      var bh = b >>> 16 & 0xffff,
        bl = b & 0xffff;
      return al * bl + (ah * bl + al * bh << 16 >>> 0) | 0;
    }
    exports.mul = Math.imul || imulShim;
    function add(a, b) {
      return a + b | 0;
    }
    exports.add = add;
    function sub(a, b) {
      return a - b | 0;
    }
    exports.sub = sub;
    function rotl(x, n) {
      return x << n | x >>> 32 - n;
    }
    exports.rotl = rotl;
    function rotr(x, n) {
      return x << 32 - n | x >>> n;
    }
    exports.rotr = rotr;
    function isIntegerShim(n) {
      return typeof n === "number" && isFinite(n) && Math.floor(n) === n;
    }
    exports.isInteger = Number.isInteger || isIntegerShim;
    exports.MAX_SAFE_INTEGER = 9007199254740991;
    exports.isSafeInteger = function (n) {
      return exports.isInteger(n) && n >= -exports.MAX_SAFE_INTEGER && n <= exports.MAX_SAFE_INTEGER;
    };
  })(int);
  Object.defineProperty(binary, "__esModule", {
    value: true
  });
  var int_1 = int;
  function readInt16BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return (array[offset + 0] << 8 | array[offset + 1]) << 16 >> 16;
  }
  binary.readInt16BE = readInt16BE;
  function readUint16BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return (array[offset + 0] << 8 | array[offset + 1]) >>> 0;
  }
  binary.readUint16BE = readUint16BE;
  function readInt16LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return (array[offset + 1] << 8 | array[offset]) << 16 >> 16;
  }
  binary.readInt16LE = readInt16LE;
  function readUint16LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return (array[offset + 1] << 8 | array[offset]) >>> 0;
  }
  binary.readUint16LE = readUint16LE;
  function writeUint16BE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(2);
    }
    if (offset === void 0) {
      offset = 0;
    }
    out[offset + 0] = value >>> 8;
    out[offset + 1] = value >>> 0;
    return out;
  }
  binary.writeUint16BE = writeUint16BE;
  binary.writeInt16BE = writeUint16BE;
  function writeUint16LE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(2);
    }
    if (offset === void 0) {
      offset = 0;
    }
    out[offset + 0] = value >>> 0;
    out[offset + 1] = value >>> 8;
    return out;
  }
  binary.writeUint16LE = writeUint16LE;
  binary.writeInt16LE = writeUint16LE;
  function readInt32BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return array[offset] << 24 | array[offset + 1] << 16 | array[offset + 2] << 8 | array[offset + 3];
  }
  binary.readInt32BE = readInt32BE;
  function readUint32BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return (array[offset] << 24 | array[offset + 1] << 16 | array[offset + 2] << 8 | array[offset + 3]) >>> 0;
  }
  binary.readUint32BE = readUint32BE;
  function readInt32LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return array[offset + 3] << 24 | array[offset + 2] << 16 | array[offset + 1] << 8 | array[offset];
  }
  binary.readInt32LE = readInt32LE;
  function readUint32LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    return (array[offset + 3] << 24 | array[offset + 2] << 16 | array[offset + 1] << 8 | array[offset]) >>> 0;
  }
  binary.readUint32LE = readUint32LE;
  function writeUint32BE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(4);
    }
    if (offset === void 0) {
      offset = 0;
    }
    out[offset + 0] = value >>> 24;
    out[offset + 1] = value >>> 16;
    out[offset + 2] = value >>> 8;
    out[offset + 3] = value >>> 0;
    return out;
  }
  binary.writeUint32BE = writeUint32BE;
  binary.writeInt32BE = writeUint32BE;
  function writeUint32LE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(4);
    }
    if (offset === void 0) {
      offset = 0;
    }
    out[offset + 0] = value >>> 0;
    out[offset + 1] = value >>> 8;
    out[offset + 2] = value >>> 16;
    out[offset + 3] = value >>> 24;
    return out;
  }
  binary.writeUint32LE = writeUint32LE;
  binary.writeInt32LE = writeUint32LE;
  function readInt64BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var hi = readInt32BE(array, offset);
    var lo = readInt32BE(array, offset + 4);
    return hi * 0x100000000 + lo - (lo >> 31) * 0x100000000;
  }
  binary.readInt64BE = readInt64BE;
  function readUint64BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var hi = readUint32BE(array, offset);
    var lo = readUint32BE(array, offset + 4);
    return hi * 0x100000000 + lo;
  }
  binary.readUint64BE = readUint64BE;
  function readInt64LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var lo = readInt32LE(array, offset);
    var hi = readInt32LE(array, offset + 4);
    return hi * 0x100000000 + lo - (lo >> 31) * 0x100000000;
  }
  binary.readInt64LE = readInt64LE;
  function readUint64LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var lo = readUint32LE(array, offset);
    var hi = readUint32LE(array, offset + 4);
    return hi * 0x100000000 + lo;
  }
  binary.readUint64LE = readUint64LE;
  function writeUint64BE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(8);
    }
    if (offset === void 0) {
      offset = 0;
    }
    writeUint32BE(value / 0x100000000 >>> 0, out, offset);
    writeUint32BE(value >>> 0, out, offset + 4);
    return out;
  }
  binary.writeUint64BE = writeUint64BE;
  binary.writeInt64BE = writeUint64BE;
  function writeUint64LE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(8);
    }
    if (offset === void 0) {
      offset = 0;
    }
    writeUint32LE(value >>> 0, out, offset);
    writeUint32LE(value / 0x100000000 >>> 0, out, offset + 4);
    return out;
  }
  binary.writeUint64LE = writeUint64LE;
  binary.writeInt64LE = writeUint64LE;
  function readUintBE(bitLength, array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    if (bitLength % 8 !== 0) {
      throw new Error("readUintBE supports only bitLengths divisible by 8");
    }
    if (bitLength / 8 > array.length - offset) {
      throw new Error("readUintBE: array is too short for the given bitLength");
    }
    var result = 0;
    var mul = 1;
    for (var i = bitLength / 8 + offset - 1; i >= offset; i--) {
      result += array[i] * mul;
      mul *= 256;
    }
    return result;
  }
  binary.readUintBE = readUintBE;
  function readUintLE(bitLength, array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    if (bitLength % 8 !== 0) {
      throw new Error("readUintLE supports only bitLengths divisible by 8");
    }
    if (bitLength / 8 > array.length - offset) {
      throw new Error("readUintLE: array is too short for the given bitLength");
    }
    var result = 0;
    var mul = 1;
    for (var i = offset; i < offset + bitLength / 8; i++) {
      result += array[i] * mul;
      mul *= 256;
    }
    return result;
  }
  binary.readUintLE = readUintLE;
  function writeUintBE(bitLength, value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(bitLength / 8);
    }
    if (offset === void 0) {
      offset = 0;
    }
    if (bitLength % 8 !== 0) {
      throw new Error("writeUintBE supports only bitLengths divisible by 8");
    }
    if (!int_1.isSafeInteger(value)) {
      throw new Error("writeUintBE value must be an integer");
    }
    var div = 1;
    for (var i = bitLength / 8 + offset - 1; i >= offset; i--) {
      out[i] = value / div & 0xff;
      div *= 256;
    }
    return out;
  }
  binary.writeUintBE = writeUintBE;
  function writeUintLE(bitLength, value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(bitLength / 8);
    }
    if (offset === void 0) {
      offset = 0;
    }
    if (bitLength % 8 !== 0) {
      throw new Error("writeUintLE supports only bitLengths divisible by 8");
    }
    if (!int_1.isSafeInteger(value)) {
      throw new Error("writeUintLE value must be an integer");
    }
    var div = 1;
    for (var i = offset; i < offset + bitLength / 8; i++) {
      out[i] = value / div & 0xff;
      div *= 256;
    }
    return out;
  }
  binary.writeUintLE = writeUintLE;
  function readFloat32BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(array.buffer, array.byteOffset, array.byteLength);
    return view.getFloat32(offset);
  }
  binary.readFloat32BE = readFloat32BE;
  function readFloat32LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(array.buffer, array.byteOffset, array.byteLength);
    return view.getFloat32(offset, true);
  }
  binary.readFloat32LE = readFloat32LE;
  function readFloat64BE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(array.buffer, array.byteOffset, array.byteLength);
    return view.getFloat64(offset);
  }
  binary.readFloat64BE = readFloat64BE;
  function readFloat64LE(array, offset) {
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(array.buffer, array.byteOffset, array.byteLength);
    return view.getFloat64(offset, true);
  }
  binary.readFloat64LE = readFloat64LE;
  function writeFloat32BE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(4);
    }
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setFloat32(offset, value);
    return out;
  }
  binary.writeFloat32BE = writeFloat32BE;
  function writeFloat32LE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(4);
    }
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setFloat32(offset, value, true);
    return out;
  }
  binary.writeFloat32LE = writeFloat32LE;
  function writeFloat64BE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(8);
    }
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setFloat64(offset, value);
    return out;
  }
  binary.writeFloat64BE = writeFloat64BE;
  function writeFloat64LE(value, out, offset) {
    if (out === void 0) {
      out = new Uint8Array(8);
    }
    if (offset === void 0) {
      offset = 0;
    }
    var view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setFloat64(offset, value, true);
    return out;
  }
  binary.writeFloat64LE = writeFloat64LE;
  var wipe$1 = {};
  Object.defineProperty(wipe$1, "__esModule", {
    value: true
  });
  function wipe(array) {
    for (var i = 0; i < array.length; i++) {
      array[i] = 0;
    }
    return array;
  }
  wipe$1.wipe = wipe;
  var __extends = commonjsGlobal && commonjsGlobal.__extends || function () {
    var _extendStatics = function extendStatics(d, b) {
      _extendStatics = Object.setPrototypeOf || {
        __proto__: []
      } instanceof Array && function (d, b) {
        d.__proto__ = b;
      } || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
      };
      return _extendStatics(d, b);
    };
    return function (d, b) {
      _extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
  }();
  Object.defineProperty(sha3, "__esModule", {
    value: true
  });
  var binary_1 = binary;
  var wipe_1 = wipe$1;
  var Keccak = function () {
    function Keccak(capacity) {
      if (capacity === void 0) {
        capacity = 32;
      }
      this.capacity = capacity;
      this._sh = new Int32Array(25);
      this._sl = new Int32Array(25);
      this._state = new Uint8Array(200);
      this._pos = 0;
      this._finished = false;
      this.clean = this.reset;
      if (capacity <= 0 || capacity > 128) {
        throw new Error("SHA3: incorrect capacity");
      }
      this.blockSize = 200 - capacity;
    }
    Keccak.prototype.reset = function () {
      wipe_1.wipe(this._sh);
      wipe_1.wipe(this._sl);
      wipe_1.wipe(this._state);
      this._pos = 0;
      this._finished = false;
      return this;
    };
    Keccak.prototype.update = function (data) {
      if (this._finished) {
        throw new Error("SHA3: can't update because hash was finished");
      }
      for (var i = 0; i < data.length; i++) {
        this._state[this._pos++] ^= data[i];
        if (this._pos >= this.blockSize) {
          keccakf(this._sh, this._sl, this._state);
          this._pos = 0;
        }
      }
      return this;
    };
    Keccak.prototype._padAndPermute = function (paddingByte) {
      this._state[this._pos] ^= paddingByte;
      this._state[this.blockSize - 1] ^= 0x80;
      keccakf(this._sh, this._sl, this._state);
      this._finished = true;
      this._pos = 0;
    };
    Keccak.prototype._squeeze = function (dst) {
      if (!this._finished) {
        throw new Error("SHA3: squeezing before padAndPermute");
      }
      for (var i = 0; i < dst.length; i++) {
        if (this._pos === this.blockSize) {
          keccakf(this._sh, this._sl, this._state);
          this._pos = 0;
        }
        dst[i] = this._state[this._pos++];
      }
    };
    return Keccak;
  }();
  sha3.Keccak = Keccak;
  var SHA3 = function (_super) {
    __extends(SHA3, _super);
    function SHA3(digestLength) {
      if (digestLength === void 0) {
        digestLength = 32;
      }
      var _this = _super.call(this, digestLength * 2) || this;
      _this.digestLength = digestLength;
      return _this;
    }
    SHA3.prototype.finish = function (dst) {
      if (!this._finished) {
        this._padAndPermute(0x06);
      } else {
        this._pos = 0;
      }
      this._squeeze(dst);
      return this;
    };
    SHA3.prototype.digest = function () {
      var out = new Uint8Array(this.digestLength);
      this.finish(out);
      return out;
    };
    SHA3.prototype.saveState = function () {
      if (this._finished) {
        throw new Error("SHA3: cannot save finished state");
      }
      return new Uint8Array(this._state.subarray(0, this._pos));
    };
    SHA3.prototype.restoreState = function (savedState) {
      this._state.set(savedState);
      this._pos = savedState.length;
      this._finished = false;
      return this;
    };
    SHA3.prototype.cleanSavedState = function (savedState) {
      wipe_1.wipe(savedState);
    };
    return SHA3;
  }(Keccak);
  sha3.SHA3 = SHA3;
  var SHA3224 = function (_super) {
    __extends(SHA3224, _super);
    function SHA3224() {
      return _super.call(this, 224 / 8) || this;
    }
    return SHA3224;
  }(SHA3);
  sha3.SHA3224 = SHA3224;
  var SHA3256 = function (_super) {
    __extends(SHA3256, _super);
    function SHA3256() {
      return _super.call(this, 256 / 8) || this;
    }
    return SHA3256;
  }(SHA3);
  sha3.SHA3256 = SHA3256;
  var SHA3384 = function (_super) {
    __extends(SHA3384, _super);
    function SHA3384() {
      return _super.call(this, 384 / 8) || this;
    }
    return SHA3384;
  }(SHA3);
  sha3.SHA3384 = SHA3384;
  var SHA3512 = function (_super) {
    __extends(SHA3512, _super);
    function SHA3512() {
      return _super.call(this, 512 / 8) || this;
    }
    return SHA3512;
  }(SHA3);
  sha3.SHA3512 = SHA3512;
  function hash(digestLength, data) {
    var h = new SHA3(digestLength);
    h.update(data);
    var digest = h.digest();
    h.clean();
    return digest;
  }
  sha3.hash = hash;
  sha3.hash224 = function (data) {
    return hash(224 / 8, data);
  };
  var hash256 = sha3.hash256 = function (data) {
    return hash(256 / 8, data);
  };
  var hash384 = sha3.hash384 = function (data) {
    return hash(384 / 8, data);
  };
  var hash512 = sha3.hash512 = function (data) {
    return hash(512 / 8, data);
  };
  var SHAKE = function (_super) {
    __extends(SHAKE, _super);
    function SHAKE(bitSize) {
      var _this = _super.call(this, bitSize / 8 * 2) || this;
      _this.bitSize = bitSize;
      return _this;
    }
    SHAKE.prototype.stream = function (dst) {
      if (!this._finished) {
        this._padAndPermute(0x1f);
      }
      this._squeeze(dst);
    };
    return SHAKE;
  }(Keccak);
  sha3.SHAKE = SHAKE;
  var SHAKE128 = function (_super) {
    __extends(SHAKE128, _super);
    function SHAKE128() {
      return _super.call(this, 128) || this;
    }
    return SHAKE128;
  }(SHAKE);
  var SHAKE128_1 = sha3.SHAKE128 = SHAKE128;
  var SHAKE256 = function (_super) {
    __extends(SHAKE256, _super);
    function SHAKE256() {
      return _super.call(this, 256) || this;
    }
    return SHAKE256;
  }(SHAKE);
  var SHAKE256_1 = sha3.SHAKE256 = SHAKE256;
  var RNDC_HI = new Int32Array([0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000]);
  var RNDC_LO = new Int32Array([0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001, 0x80008081, 0x00008009, 0x0000008a, 0x00000088, 0x80008009, 0x8000000a, 0x8000808b, 0x0000008b, 0x00008089, 0x00008003, 0x00008002, 0x00000080, 0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008]);
  function keccakf(sh, sl, buf) {
    var bch0, bch1, bch2, bch3, bch4;
    var bcl0, bcl1, bcl2, bcl3, bcl4;
    var th, tl;
    for (var i = 0; i < 25; i++) {
      sl[i] = binary_1.readUint32LE(buf, i * 8);
      sh[i] = binary_1.readUint32LE(buf, i * 8 + 4);
    }
    for (var r = 0; r < 24; r++) {
      bch0 = sh[0] ^ sh[5] ^ sh[10] ^ sh[15] ^ sh[20];
      bch1 = sh[1] ^ sh[6] ^ sh[11] ^ sh[16] ^ sh[21];
      bch2 = sh[2] ^ sh[7] ^ sh[12] ^ sh[17] ^ sh[22];
      bch3 = sh[3] ^ sh[8] ^ sh[13] ^ sh[18] ^ sh[23];
      bch4 = sh[4] ^ sh[9] ^ sh[14] ^ sh[19] ^ sh[24];
      bcl0 = sl[0] ^ sl[5] ^ sl[10] ^ sl[15] ^ sl[20];
      bcl1 = sl[1] ^ sl[6] ^ sl[11] ^ sl[16] ^ sl[21];
      bcl2 = sl[2] ^ sl[7] ^ sl[12] ^ sl[17] ^ sl[22];
      bcl3 = sl[3] ^ sl[8] ^ sl[13] ^ sl[18] ^ sl[23];
      bcl4 = sl[4] ^ sl[9] ^ sl[14] ^ sl[19] ^ sl[24];
      th = bch4 ^ (bch1 << 1 | bcl1 >>> 32 - 1);
      tl = bcl4 ^ (bcl1 << 1 | bch1 >>> 32 - 1);
      sh[0] ^= th;
      sh[5] ^= th;
      sh[10] ^= th;
      sh[15] ^= th;
      sh[20] ^= th;
      sl[0] ^= tl;
      sl[5] ^= tl;
      sl[10] ^= tl;
      sl[15] ^= tl;
      sl[20] ^= tl;
      th = bch0 ^ (bch2 << 1 | bcl2 >>> 32 - 1);
      tl = bcl0 ^ (bcl2 << 1 | bch2 >>> 32 - 1);
      sh[1] ^= th;
      sh[6] ^= th;
      sh[11] ^= th;
      sh[16] ^= th;
      sh[21] ^= th;
      sl[1] ^= tl;
      sl[6] ^= tl;
      sl[11] ^= tl;
      sl[16] ^= tl;
      sl[21] ^= tl;
      th = bch1 ^ (bch3 << 1 | bcl3 >>> 32 - 1);
      tl = bcl1 ^ (bcl3 << 1 | bch3 >>> 32 - 1);
      sh[2] ^= th;
      sh[7] ^= th;
      sh[12] ^= th;
      sh[17] ^= th;
      sh[22] ^= th;
      sl[2] ^= tl;
      sl[7] ^= tl;
      sl[12] ^= tl;
      sl[17] ^= tl;
      sl[22] ^= tl;
      th = bch2 ^ (bch4 << 1 | bcl4 >>> 32 - 1);
      tl = bcl2 ^ (bcl4 << 1 | bch4 >>> 32 - 1);
      sh[3] ^= th;
      sl[3] ^= tl;
      sh[8] ^= th;
      sl[8] ^= tl;
      sh[13] ^= th;
      sl[13] ^= tl;
      sh[18] ^= th;
      sl[18] ^= tl;
      sh[23] ^= th;
      sl[23] ^= tl;
      th = bch3 ^ (bch0 << 1 | bcl0 >>> 32 - 1);
      tl = bcl3 ^ (bcl0 << 1 | bch0 >>> 32 - 1);
      sh[4] ^= th;
      sh[9] ^= th;
      sh[14] ^= th;
      sh[19] ^= th;
      sh[24] ^= th;
      sl[4] ^= tl;
      sl[9] ^= tl;
      sl[14] ^= tl;
      sl[19] ^= tl;
      sl[24] ^= tl;
      th = sh[1];
      tl = sl[1];
      bch0 = sh[10];
      bcl0 = sl[10];
      sh[10] = th << 1 | tl >>> 32 - 1;
      sl[10] = tl << 1 | th >>> 32 - 1;
      th = bch0;
      tl = bcl0;
      bch0 = sh[7];
      bcl0 = sl[7];
      sh[7] = th << 3 | tl >>> 32 - 3;
      sl[7] = tl << 3 | th >>> 32 - 3;
      th = bch0;
      tl = bcl0;
      bch0 = sh[11];
      bcl0 = sl[11];
      sh[11] = th << 6 | tl >>> 32 - 6;
      sl[11] = tl << 6 | th >>> 32 - 6;
      th = bch0;
      tl = bcl0;
      bch0 = sh[17];
      bcl0 = sl[17];
      sh[17] = th << 10 | tl >>> 32 - 10;
      sl[17] = tl << 10 | th >>> 32 - 10;
      th = bch0;
      tl = bcl0;
      bch0 = sh[18];
      bcl0 = sl[18];
      sh[18] = th << 15 | tl >>> 32 - 15;
      sl[18] = tl << 15 | th >>> 32 - 15;
      th = bch0;
      tl = bcl0;
      bch0 = sh[3];
      bcl0 = sl[3];
      sh[3] = th << 21 | tl >>> 32 - 21;
      sl[3] = tl << 21 | th >>> 32 - 21;
      th = bch0;
      tl = bcl0;
      bch0 = sh[5];
      bcl0 = sl[5];
      sh[5] = th << 28 | tl >>> 32 - 28;
      sl[5] = tl << 28 | th >>> 32 - 28;
      th = bch0;
      tl = bcl0;
      bch0 = sh[16];
      bcl0 = sl[16];
      sh[16] = tl << 4 | th >>> 32 - 4;
      sl[16] = th << 4 | tl >>> 32 - 4;
      th = bch0;
      tl = bcl0;
      bch0 = sh[8];
      bcl0 = sl[8];
      sh[8] = tl << 13 | th >>> 32 - 13;
      sl[8] = th << 13 | tl >>> 32 - 13;
      th = bch0;
      tl = bcl0;
      bch0 = sh[21];
      bcl0 = sl[21];
      sh[21] = tl << 23 | th >>> 32 - 23;
      sl[21] = th << 23 | tl >>> 32 - 23;
      th = bch0;
      tl = bcl0;
      bch0 = sh[24];
      bcl0 = sl[24];
      sh[24] = th << 2 | tl >>> 32 - 2;
      sl[24] = tl << 2 | th >>> 32 - 2;
      th = bch0;
      tl = bcl0;
      bch0 = sh[4];
      bcl0 = sl[4];
      sh[4] = th << 14 | tl >>> 32 - 14;
      sl[4] = tl << 14 | th >>> 32 - 14;
      th = bch0;
      tl = bcl0;
      bch0 = sh[15];
      bcl0 = sl[15];
      sh[15] = th << 27 | tl >>> 32 - 27;
      sl[15] = tl << 27 | th >>> 32 - 27;
      th = bch0;
      tl = bcl0;
      bch0 = sh[23];
      bcl0 = sl[23];
      sh[23] = tl << 9 | th >>> 32 - 9;
      sl[23] = th << 9 | tl >>> 32 - 9;
      th = bch0;
      tl = bcl0;
      bch0 = sh[19];
      bcl0 = sl[19];
      sh[19] = tl << 24 | th >>> 32 - 24;
      sl[19] = th << 24 | tl >>> 32 - 24;
      th = bch0;
      tl = bcl0;
      bch0 = sh[13];
      bcl0 = sl[13];
      sh[13] = th << 8 | tl >>> 32 - 8;
      sl[13] = tl << 8 | th >>> 32 - 8;
      th = bch0;
      tl = bcl0;
      bch0 = sh[12];
      bcl0 = sl[12];
      sh[12] = th << 25 | tl >>> 32 - 25;
      sl[12] = tl << 25 | th >>> 32 - 25;
      th = bch0;
      tl = bcl0;
      bch0 = sh[2];
      bcl0 = sl[2];
      sh[2] = tl << 11 | th >>> 32 - 11;
      sl[2] = th << 11 | tl >>> 32 - 11;
      th = bch0;
      tl = bcl0;
      bch0 = sh[20];
      bcl0 = sl[20];
      sh[20] = tl << 30 | th >>> 32 - 30;
      sl[20] = th << 30 | tl >>> 32 - 30;
      th = bch0;
      tl = bcl0;
      bch0 = sh[14];
      bcl0 = sl[14];
      sh[14] = th << 18 | tl >>> 32 - 18;
      sl[14] = tl << 18 | th >>> 32 - 18;
      th = bch0;
      tl = bcl0;
      bch0 = sh[22];
      bcl0 = sl[22];
      sh[22] = tl << 7 | th >>> 32 - 7;
      sl[22] = th << 7 | tl >>> 32 - 7;
      th = bch0;
      tl = bcl0;
      bch0 = sh[9];
      bcl0 = sl[9];
      sh[9] = tl << 29 | th >>> 32 - 29;
      sl[9] = th << 29 | tl >>> 32 - 29;
      th = bch0;
      tl = bcl0;
      bch0 = sh[6];
      bcl0 = sl[6];
      sh[6] = th << 20 | tl >>> 32 - 20;
      sl[6] = tl << 20 | th >>> 32 - 20;
      th = bch0;
      tl = bcl0;
      bch0 = sh[1];
      bcl0 = sl[1];
      sh[1] = tl << 12 | th >>> 32 - 12;
      sl[1] = th << 12 | tl >>> 32 - 12;
      th = bch0;
      tl = bcl0;
      bch0 = sh[0];
      bch1 = sh[1];
      bch2 = sh[2];
      bch3 = sh[3];
      bch4 = sh[4];
      sh[0] ^= ~bch1 & bch2;
      sh[1] ^= ~bch2 & bch3;
      sh[2] ^= ~bch3 & bch4;
      sh[3] ^= ~bch4 & bch0;
      sh[4] ^= ~bch0 & bch1;
      bcl0 = sl[0];
      bcl1 = sl[1];
      bcl2 = sl[2];
      bcl3 = sl[3];
      bcl4 = sl[4];
      sl[0] ^= ~bcl1 & bcl2;
      sl[1] ^= ~bcl2 & bcl3;
      sl[2] ^= ~bcl3 & bcl4;
      sl[3] ^= ~bcl4 & bcl0;
      sl[4] ^= ~bcl0 & bcl1;
      bch0 = sh[5];
      bch1 = sh[6];
      bch2 = sh[7];
      bch3 = sh[8];
      bch4 = sh[9];
      sh[5] ^= ~bch1 & bch2;
      sh[6] ^= ~bch2 & bch3;
      sh[7] ^= ~bch3 & bch4;
      sh[8] ^= ~bch4 & bch0;
      sh[9] ^= ~bch0 & bch1;
      bcl0 = sl[5];
      bcl1 = sl[6];
      bcl2 = sl[7];
      bcl3 = sl[8];
      bcl4 = sl[9];
      sl[5] ^= ~bcl1 & bcl2;
      sl[6] ^= ~bcl2 & bcl3;
      sl[7] ^= ~bcl3 & bcl4;
      sl[8] ^= ~bcl4 & bcl0;
      sl[9] ^= ~bcl0 & bcl1;
      bch0 = sh[10];
      bch1 = sh[11];
      bch2 = sh[12];
      bch3 = sh[13];
      bch4 = sh[14];
      sh[10] ^= ~bch1 & bch2;
      sh[11] ^= ~bch2 & bch3;
      sh[12] ^= ~bch3 & bch4;
      sh[13] ^= ~bch4 & bch0;
      sh[14] ^= ~bch0 & bch1;
      bcl0 = sl[10];
      bcl1 = sl[11];
      bcl2 = sl[12];
      bcl3 = sl[13];
      bcl4 = sl[14];
      sl[10] ^= ~bcl1 & bcl2;
      sl[11] ^= ~bcl2 & bcl3;
      sl[12] ^= ~bcl3 & bcl4;
      sl[13] ^= ~bcl4 & bcl0;
      sl[14] ^= ~bcl0 & bcl1;
      bch0 = sh[15];
      bch1 = sh[16];
      bch2 = sh[17];
      bch3 = sh[18];
      bch4 = sh[19];
      sh[15] ^= ~bch1 & bch2;
      sh[16] ^= ~bch2 & bch3;
      sh[17] ^= ~bch3 & bch4;
      sh[18] ^= ~bch4 & bch0;
      sh[19] ^= ~bch0 & bch1;
      bcl0 = sl[15];
      bcl1 = sl[16];
      bcl2 = sl[17];
      bcl3 = sl[18];
      bcl4 = sl[19];
      sl[15] ^= ~bcl1 & bcl2;
      sl[16] ^= ~bcl2 & bcl3;
      sl[17] ^= ~bcl3 & bcl4;
      sl[18] ^= ~bcl4 & bcl0;
      sl[19] ^= ~bcl0 & bcl1;
      bch0 = sh[20];
      bch1 = sh[21];
      bch2 = sh[22];
      bch3 = sh[23];
      bch4 = sh[24];
      sh[20] ^= ~bch1 & bch2;
      sh[21] ^= ~bch2 & bch3;
      sh[22] ^= ~bch3 & bch4;
      sh[23] ^= ~bch4 & bch0;
      sh[24] ^= ~bch0 & bch1;
      bcl0 = sl[20];
      bcl1 = sl[21];
      bcl2 = sl[22];
      bcl3 = sl[23];
      bcl4 = sl[24];
      sl[20] ^= ~bcl1 & bcl2;
      sl[21] ^= ~bcl2 & bcl3;
      sl[22] ^= ~bcl3 & bcl4;
      sl[23] ^= ~bcl4 & bcl0;
      sl[24] ^= ~bcl0 & bcl1;
      sh[0] ^= RNDC_HI[r];
      sl[0] ^= RNDC_LO[r];
    }
    for (var i = 0; i < 25; i++) {
      binary_1.writeUint32LE(sl[i], buf, i * 8);
      binary_1.writeUint32LE(sh[i], buf, i * 8 + 4);
    }
  }
  var Sha3256Provider = function (_ProviderCrypto10) {
    _inherits(Sha3256Provider, _ProviderCrypto10);
    function Sha3256Provider() {
      var _this98;
      _classCallCheck(this, Sha3256Provider);
      _this98 = _callSuper(this, Sha3256Provider, arguments);
      _this98.name = "SHA3-256";
      _this98.usages = [];
      return _this98;
    }
    _createClass(Sha3256Provider, [{
      key: "onDigest",
      value: function onDigest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee115() {
          return _regeneratorRuntime().wrap(function _callee115$(_context115) {
            while (1) switch (_context115.prev = _context115.next) {
              case 0:
                return _context115.abrupt("return", hash256(new Uint8Array(data)).buffer);
              case 1:
              case "end":
                return _context115.stop();
            }
          }, _callee115);
        }));
      }
    }]);
    return Sha3256Provider;
  }(ProviderCrypto);
  var Sha3384Provider = function (_ProviderCrypto11) {
    _inherits(Sha3384Provider, _ProviderCrypto11);
    function Sha3384Provider() {
      var _this99;
      _classCallCheck(this, Sha3384Provider);
      _this99 = _callSuper(this, Sha3384Provider, arguments);
      _this99.name = "SHA3-384";
      _this99.usages = [];
      return _this99;
    }
    _createClass(Sha3384Provider, [{
      key: "onDigest",
      value: function onDigest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee116() {
          return _regeneratorRuntime().wrap(function _callee116$(_context116) {
            while (1) switch (_context116.prev = _context116.next) {
              case 0:
                return _context116.abrupt("return", hash384(new Uint8Array(data)).buffer);
              case 1:
              case "end":
                return _context116.stop();
            }
          }, _callee116);
        }));
      }
    }]);
    return Sha3384Provider;
  }(ProviderCrypto);
  var Sha3512Provider = function (_ProviderCrypto12) {
    _inherits(Sha3512Provider, _ProviderCrypto12);
    function Sha3512Provider() {
      var _this100;
      _classCallCheck(this, Sha3512Provider);
      _this100 = _callSuper(this, Sha3512Provider, arguments);
      _this100.name = "SHA3-512";
      _this100.usages = [];
      return _this100;
    }
    _createClass(Sha3512Provider, [{
      key: "onDigest",
      value: function onDigest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee117() {
          return _regeneratorRuntime().wrap(function _callee117$(_context117) {
            while (1) switch (_context117.prev = _context117.next) {
              case 0:
                return _context117.abrupt("return", hash512(new Uint8Array(data)).buffer);
              case 1:
              case "end":
                return _context117.stop();
            }
          }, _callee117);
        }));
      }
    }]);
    return Sha3512Provider;
  }(ProviderCrypto);
  var Shake128Provider = function (_Shake128Provider$) {
    _inherits(Shake128Provider, _Shake128Provider$);
    function Shake128Provider() {
      _classCallCheck(this, Shake128Provider);
      return _callSuper(this, Shake128Provider, arguments);
    }
    _createClass(Shake128Provider, [{
      key: "onDigest",
      value: function onDigest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee118() {
          var output;
          return _regeneratorRuntime().wrap(function _callee118$(_context118) {
            while (1) switch (_context118.prev = _context118.next) {
              case 0:
                output = new Uint8Array(algorithm.length);
                new SHAKE128_1().update(new Uint8Array(data)).stream(output);
                return _context118.abrupt("return", output.buffer);
              case 3:
              case "end":
                return _context118.stop();
            }
          }, _callee118);
        }));
      }
    }]);
    return Shake128Provider;
  }(Shake128Provider$1);
  var Shake256Provider = function (_Shake256Provider$) {
    _inherits(Shake256Provider, _Shake256Provider$);
    function Shake256Provider() {
      _classCallCheck(this, Shake256Provider);
      return _callSuper(this, Shake256Provider, arguments);
    }
    _createClass(Shake256Provider, [{
      key: "onDigest",
      value: function onDigest(algorithm, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee119() {
          var output;
          return _regeneratorRuntime().wrap(function _callee119$(_context119) {
            while (1) switch (_context119.prev = _context119.next) {
              case 0:
                output = new Uint8Array(algorithm.length);
                new SHAKE256_1().update(new Uint8Array(data)).stream(output);
                return _context119.abrupt("return", output.buffer);
              case 3:
              case "end":
                return _context119.stop();
            }
          }, _callee119);
        }));
      }
    }]);
    return Shake256Provider;
  }(Shake256Provider$1);
  var PbkdfCryptoKey = function (_CryptoKey6) {
    _inherits(PbkdfCryptoKey, _CryptoKey6);
    function PbkdfCryptoKey(algorithm, extractable, usages, raw) {
      var _this101;
      _classCallCheck(this, PbkdfCryptoKey);
      _this101 = _callSuper(this, PbkdfCryptoKey, [algorithm, extractable, "secret", usages]);
      _this101.raw = raw;
      return _this101;
    }
    return _createClass(PbkdfCryptoKey);
  }(CryptoKey);
  var Pbkdf2Provider = function (_Pbkdf2Provider$) {
    _inherits(Pbkdf2Provider, _Pbkdf2Provider$);
    function Pbkdf2Provider() {
      _classCallCheck(this, Pbkdf2Provider);
      return _callSuper(this, Pbkdf2Provider, arguments);
    }
    _createClass(Pbkdf2Provider, [{
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee120() {
          return _regeneratorRuntime().wrap(function _callee120$(_context120) {
            while (1) switch (_context120.prev = _context120.next) {
              case 0:
                return _context120.abrupt("return", new PbkdfCryptoKey(algorithm, extractable, keyUsages, BufferSourceConverter.toUint8Array(keyData)));
              case 1:
              case "end":
                return _context120.stop();
            }
          }, _callee120);
        }));
      }
    }, {
      key: "onDeriveBits",
      value: function onDeriveBits(algorithm, baseKey, length) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee121() {
          var result, salt, password;
          return _regeneratorRuntime().wrap(function _callee121$(_context121) {
            while (1) switch (_context121.prev = _context121.next) {
              case 0:
                salt = BufferSourceConverter.toUint8Array(algorithm.salt);
                password = baseKey.raw;
                _context121.t0 = algorithm.hash.name.toUpperCase();
                _context121.next = _context121.t0 === "SHA-1" ? 5 : _context121.t0 === "SHA-256" ? 7 : _context121.t0 === "SHA-512" ? 9 : 11;
                break;
              case 5:
                result = asmCrypto__namespace.Pbkdf2HmacSha1(password, salt, algorithm.iterations, length >> 3);
                return _context121.abrupt("break", 12);
              case 7:
                result = asmCrypto__namespace.Pbkdf2HmacSha256(password, salt, algorithm.iterations, length >> 3);
                return _context121.abrupt("break", 12);
              case 9:
                result = asmCrypto__namespace.Pbkdf2HmacSha512(password, salt, algorithm.iterations, length >> 3);
                return _context121.abrupt("break", 12);
              case 11:
                throw new OperationError("algorithm.hash: '".concat(algorithm.hash.name, "' hash algorithm is not supported"));
              case 12:
                return _context121.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 13:
              case "end":
                return _context121.stop();
            }
          }, _callee121);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(Pbkdf2Provider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        if (!(key instanceof PbkdfCryptoKey)) {
          throw new TypeError("key: Is not PbkdfCryptoKey");
        }
      }
    }]);
    return Pbkdf2Provider;
  }(Pbkdf2Provider$1);
  var des$2 = {};
  var utils$2 = {};
  utils$2.readUInt32BE = function readUInt32BE(bytes, off) {
    var res = bytes[0 + off] << 24 | bytes[1 + off] << 16 | bytes[2 + off] << 8 | bytes[3 + off];
    return res >>> 0;
  };
  utils$2.writeUInt32BE = function writeUInt32BE(bytes, value, off) {
    bytes[0 + off] = value >>> 24;
    bytes[1 + off] = value >>> 16 & 0xff;
    bytes[2 + off] = value >>> 8 & 0xff;
    bytes[3 + off] = value & 0xff;
  };
  utils$2.ip = function ip(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;
    for (var i = 6; i >= 0; i -= 2) {
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= inR >>> j + i & 1;
      }
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= inL >>> j + i & 1;
      }
    }
    for (var i = 6; i >= 0; i -= 2) {
      for (var j = 1; j <= 25; j += 8) {
        outR <<= 1;
        outR |= inR >>> j + i & 1;
      }
      for (var j = 1; j <= 25; j += 8) {
        outR <<= 1;
        outR |= inL >>> j + i & 1;
      }
    }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };
  utils$2.rip = function rip(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;
    for (var i = 0; i < 4; i++) {
      for (var j = 24; j >= 0; j -= 8) {
        outL <<= 1;
        outL |= inR >>> j + i & 1;
        outL <<= 1;
        outL |= inL >>> j + i & 1;
      }
    }
    for (var i = 4; i < 8; i++) {
      for (var j = 24; j >= 0; j -= 8) {
        outR <<= 1;
        outR |= inR >>> j + i & 1;
        outR <<= 1;
        outR |= inL >>> j + i & 1;
      }
    }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };
  utils$2.pc1 = function pc1(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;
    for (var i = 7; i >= 5; i--) {
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= inR >> j + i & 1;
      }
      for (var j = 0; j <= 24; j += 8) {
        outL <<= 1;
        outL |= inL >> j + i & 1;
      }
    }
    for (var j = 0; j <= 24; j += 8) {
      outL <<= 1;
      outL |= inR >> j + i & 1;
    }
    for (var i = 1; i <= 3; i++) {
      for (var j = 0; j <= 24; j += 8) {
        outR <<= 1;
        outR |= inR >> j + i & 1;
      }
      for (var j = 0; j <= 24; j += 8) {
        outR <<= 1;
        outR |= inL >> j + i & 1;
      }
    }
    for (var j = 0; j <= 24; j += 8) {
      outR <<= 1;
      outR |= inL >> j + i & 1;
    }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };
  utils$2.r28shl = function r28shl(num, shift) {
    return num << shift & 0xfffffff | num >>> 28 - shift;
  };
  var pc2table = [14, 11, 17, 4, 27, 23, 25, 0, 13, 22, 7, 18, 5, 9, 16, 24, 2, 20, 12, 21, 1, 8, 15, 26, 15, 4, 25, 19, 9, 1, 26, 16, 5, 11, 23, 8, 12, 7, 17, 0, 22, 3, 10, 14, 6, 20, 27, 24];
  utils$2.pc2 = function pc2(inL, inR, out, off) {
    var outL = 0;
    var outR = 0;
    var len = pc2table.length >>> 1;
    for (var i = 0; i < len; i++) {
      outL <<= 1;
      outL |= inL >>> pc2table[i] & 0x1;
    }
    for (var i = len; i < pc2table.length; i++) {
      outR <<= 1;
      outR |= inR >>> pc2table[i] & 0x1;
    }
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };
  utils$2.expand = function expand(r, out, off) {
    var outL = 0;
    var outR = 0;
    outL = (r & 1) << 5 | r >>> 27;
    for (var i = 23; i >= 15; i -= 4) {
      outL <<= 6;
      outL |= r >>> i & 0x3f;
    }
    for (var i = 11; i >= 3; i -= 4) {
      outR |= r >>> i & 0x3f;
      outR <<= 6;
    }
    outR |= (r & 0x1f) << 1 | r >>> 31;
    out[off + 0] = outL >>> 0;
    out[off + 1] = outR >>> 0;
  };
  var sTable = [14, 0, 4, 15, 13, 7, 1, 4, 2, 14, 15, 2, 11, 13, 8, 1, 3, 10, 10, 6, 6, 12, 12, 11, 5, 9, 9, 5, 0, 3, 7, 8, 4, 15, 1, 12, 14, 8, 8, 2, 13, 4, 6, 9, 2, 1, 11, 7, 15, 5, 12, 11, 9, 3, 7, 14, 3, 10, 10, 0, 5, 6, 0, 13, 15, 3, 1, 13, 8, 4, 14, 7, 6, 15, 11, 2, 3, 8, 4, 14, 9, 12, 7, 0, 2, 1, 13, 10, 12, 6, 0, 9, 5, 11, 10, 5, 0, 13, 14, 8, 7, 10, 11, 1, 10, 3, 4, 15, 13, 4, 1, 2, 5, 11, 8, 6, 12, 7, 6, 12, 9, 0, 3, 5, 2, 14, 15, 9, 10, 13, 0, 7, 9, 0, 14, 9, 6, 3, 3, 4, 15, 6, 5, 10, 1, 2, 13, 8, 12, 5, 7, 14, 11, 12, 4, 11, 2, 15, 8, 1, 13, 1, 6, 10, 4, 13, 9, 0, 8, 6, 15, 9, 3, 8, 0, 7, 11, 4, 1, 15, 2, 14, 12, 3, 5, 11, 10, 5, 14, 2, 7, 12, 7, 13, 13, 8, 14, 11, 3, 5, 0, 6, 6, 15, 9, 0, 10, 3, 1, 4, 2, 7, 8, 2, 5, 12, 11, 1, 12, 10, 4, 14, 15, 9, 10, 3, 6, 15, 9, 0, 0, 6, 12, 10, 11, 1, 7, 13, 13, 8, 15, 9, 1, 4, 3, 5, 14, 11, 5, 12, 2, 7, 8, 2, 4, 14, 2, 14, 12, 11, 4, 2, 1, 12, 7, 4, 10, 7, 11, 13, 6, 1, 8, 5, 5, 0, 3, 15, 15, 10, 13, 3, 0, 9, 14, 8, 9, 6, 4, 11, 2, 8, 1, 12, 11, 7, 10, 1, 13, 14, 7, 2, 8, 13, 15, 6, 9, 15, 12, 0, 5, 9, 6, 10, 3, 4, 0, 5, 14, 3, 12, 10, 1, 15, 10, 4, 15, 2, 9, 7, 2, 12, 6, 9, 8, 5, 0, 6, 13, 1, 3, 13, 4, 14, 14, 0, 7, 11, 5, 3, 11, 8, 9, 4, 14, 3, 15, 2, 5, 12, 2, 9, 8, 5, 12, 15, 3, 10, 7, 11, 0, 14, 4, 1, 10, 7, 1, 6, 13, 0, 11, 8, 6, 13, 4, 13, 11, 0, 2, 11, 14, 7, 15, 4, 0, 9, 8, 1, 13, 10, 3, 14, 12, 3, 9, 5, 7, 12, 5, 2, 10, 15, 6, 8, 1, 6, 1, 6, 4, 11, 11, 13, 13, 8, 12, 1, 3, 4, 7, 10, 14, 7, 10, 9, 15, 5, 6, 0, 8, 15, 0, 14, 5, 2, 9, 3, 2, 12, 13, 1, 2, 15, 8, 13, 4, 8, 6, 10, 15, 3, 11, 7, 1, 4, 10, 12, 9, 5, 3, 6, 14, 11, 5, 0, 0, 14, 12, 9, 7, 2, 7, 2, 11, 1, 4, 14, 1, 7, 9, 4, 12, 10, 14, 8, 2, 13, 0, 15, 6, 12, 10, 9, 13, 0, 15, 3, 3, 5, 5, 6, 8, 11];
  utils$2.substitute = function substitute(inL, inR) {
    var out = 0;
    for (var i = 0; i < 4; i++) {
      var b = inL >>> 18 - i * 6 & 0x3f;
      var sb = sTable[i * 0x40 + b];
      out <<= 4;
      out |= sb;
    }
    for (var i = 0; i < 4; i++) {
      var b = inR >>> 18 - i * 6 & 0x3f;
      var sb = sTable[4 * 0x40 + i * 0x40 + b];
      out <<= 4;
      out |= sb;
    }
    return out >>> 0;
  };
  var permuteTable = [16, 25, 12, 11, 3, 20, 4, 15, 31, 17, 9, 6, 27, 14, 1, 22, 30, 24, 8, 18, 0, 5, 29, 23, 13, 19, 2, 26, 10, 21, 28, 7];
  utils$2.permute = function permute(num) {
    var out = 0;
    for (var i = 0; i < permuteTable.length; i++) {
      out <<= 1;
      out |= num >>> permuteTable[i] & 0x1;
    }
    return out >>> 0;
  };
  utils$2.padSplit = function padSplit(num, size, group) {
    var str = num.toString(2);
    while (str.length < size) str = '0' + str;
    var out = [];
    for (var i = 0; i < size; i += group) out.push(str.slice(i, i + group));
    return out.join(' ');
  };
  var minimalisticAssert = assert$4;
  function assert$4(val, msg) {
    if (!val) throw new Error(msg || 'Assertion failed');
  }
  assert$4.equal = function assertEqual(l, r, msg) {
    if (l != r) throw new Error(msg || 'Assertion failed: ' + l + ' != ' + r);
  };
  var assert$3 = minimalisticAssert;
  function Cipher$3(options) {
    this.options = options;
    this.type = this.options.type;
    this.blockSize = 8;
    this._init();
    this.buffer = new Array(this.blockSize);
    this.bufferOff = 0;
    this.padding = options.padding !== false;
  }
  var cipher = Cipher$3;
  Cipher$3.prototype._init = function _init() {};
  Cipher$3.prototype.update = function update(data) {
    if (data.length === 0) return [];
    if (this.type === 'decrypt') return this._updateDecrypt(data);else return this._updateEncrypt(data);
  };
  Cipher$3.prototype._buffer = function _buffer(data, off) {
    var min = Math.min(this.buffer.length - this.bufferOff, data.length - off);
    for (var i = 0; i < min; i++) this.buffer[this.bufferOff + i] = data[off + i];
    this.bufferOff += min;
    return min;
  };
  Cipher$3.prototype._flushBuffer = function _flushBuffer(out, off) {
    this._update(this.buffer, 0, out, off);
    this.bufferOff = 0;
    return this.blockSize;
  };
  Cipher$3.prototype._updateEncrypt = function _updateEncrypt(data) {
    var inputOff = 0;
    var outputOff = 0;
    var count = (this.bufferOff + data.length) / this.blockSize | 0;
    var out = new Array(count * this.blockSize);
    if (this.bufferOff !== 0) {
      inputOff += this._buffer(data, inputOff);
      if (this.bufferOff === this.buffer.length) outputOff += this._flushBuffer(out, outputOff);
    }
    var max = data.length - (data.length - inputOff) % this.blockSize;
    for (; inputOff < max; inputOff += this.blockSize) {
      this._update(data, inputOff, out, outputOff);
      outputOff += this.blockSize;
    }
    for (; inputOff < data.length; inputOff++, this.bufferOff++) this.buffer[this.bufferOff] = data[inputOff];
    return out;
  };
  Cipher$3.prototype._updateDecrypt = function _updateDecrypt(data) {
    var inputOff = 0;
    var outputOff = 0;
    var count = Math.ceil((this.bufferOff + data.length) / this.blockSize) - 1;
    var out = new Array(count * this.blockSize);
    for (; count > 0; count--) {
      inputOff += this._buffer(data, inputOff);
      outputOff += this._flushBuffer(out, outputOff);
    }
    inputOff += this._buffer(data, inputOff);
    return out;
  };
  Cipher$3.prototype.final = function final(buffer) {
    var first;
    if (buffer) first = this.update(buffer);
    var last;
    if (this.type === 'encrypt') last = this._finalEncrypt();else last = this._finalDecrypt();
    if (first) return first.concat(last);else return last;
  };
  Cipher$3.prototype._pad = function _pad(buffer, off) {
    if (off === 0) return false;
    while (off < buffer.length) buffer[off++] = 0;
    return true;
  };
  Cipher$3.prototype._finalEncrypt = function _finalEncrypt() {
    if (!this._pad(this.buffer, this.bufferOff)) return [];
    var out = new Array(this.blockSize);
    this._update(this.buffer, 0, out, 0);
    return out;
  };
  Cipher$3.prototype._unpad = function _unpad(buffer) {
    return buffer;
  };
  Cipher$3.prototype._finalDecrypt = function _finalDecrypt() {
    assert$3.equal(this.bufferOff, this.blockSize, 'Not enough data to decrypt');
    var out = new Array(this.blockSize);
    this._flushBuffer(out, 0);
    return this._unpad(out);
  };
  var inherits$3 = {
    exports: {}
  };
  var inherits_browser = {
    exports: {}
  };
  var hasRequiredInherits_browser;
  function requireInherits_browser() {
    if (hasRequiredInherits_browser) return inherits_browser.exports;
    hasRequiredInherits_browser = 1;
    if (typeof Object.create === 'function') {
      inherits_browser.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        }
      };
    } else {
      inherits_browser.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function TempCtor() {};
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
      };
    }
    return inherits_browser.exports;
  }
  try {
    var util = require('util');
    if (typeof util.inherits !== 'function') throw '';
    inherits$3.exports = util.inherits;
  } catch (e) {
    inherits$3.exports = requireInherits_browser();
  }
  var inheritsExports = inherits$3.exports;
  var assert$2 = minimalisticAssert;
  var inherits$2 = inheritsExports;
  var utils$1 = utils$2;
  var Cipher$2 = cipher;
  function DESState() {
    this.tmp = new Array(2);
    this.keys = null;
  }
  function DES$2(options) {
    Cipher$2.call(this, options);
    var state = new DESState();
    this._desState = state;
    this.deriveKeys(state, options.key);
  }
  inherits$2(DES$2, Cipher$2);
  var des$1 = DES$2;
  DES$2.create = function create(options) {
    return new DES$2(options);
  };
  var shiftTable = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
  DES$2.prototype.deriveKeys = function deriveKeys(state, key) {
    state.keys = new Array(16 * 2);
    assert$2.equal(key.length, this.blockSize, 'Invalid key length');
    var kL = utils$1.readUInt32BE(key, 0);
    var kR = utils$1.readUInt32BE(key, 4);
    utils$1.pc1(kL, kR, state.tmp, 0);
    kL = state.tmp[0];
    kR = state.tmp[1];
    for (var i = 0; i < state.keys.length; i += 2) {
      var shift = shiftTable[i >>> 1];
      kL = utils$1.r28shl(kL, shift);
      kR = utils$1.r28shl(kR, shift);
      utils$1.pc2(kL, kR, state.keys, i);
    }
  };
  DES$2.prototype._update = function _update(inp, inOff, out, outOff) {
    var state = this._desState;
    var l = utils$1.readUInt32BE(inp, inOff);
    var r = utils$1.readUInt32BE(inp, inOff + 4);
    utils$1.ip(l, r, state.tmp, 0);
    l = state.tmp[0];
    r = state.tmp[1];
    if (this.type === 'encrypt') this._encrypt(state, l, r, state.tmp, 0);else this._decrypt(state, l, r, state.tmp, 0);
    l = state.tmp[0];
    r = state.tmp[1];
    utils$1.writeUInt32BE(out, l, outOff);
    utils$1.writeUInt32BE(out, r, outOff + 4);
  };
  DES$2.prototype._pad = function _pad(buffer, off) {
    if (this.padding === false) {
      return false;
    }
    var value = buffer.length - off;
    for (var i = off; i < buffer.length; i++) buffer[i] = value;
    return true;
  };
  DES$2.prototype._unpad = function _unpad(buffer) {
    if (this.padding === false) {
      return buffer;
    }
    var pad = buffer[buffer.length - 1];
    for (var i = buffer.length - pad; i < buffer.length; i++) assert$2.equal(buffer[i], pad);
    return buffer.slice(0, buffer.length - pad);
  };
  DES$2.prototype._encrypt = function _encrypt(state, lStart, rStart, out, off) {
    var l = lStart;
    var r = rStart;
    for (var i = 0; i < state.keys.length; i += 2) {
      var keyL = state.keys[i];
      var keyR = state.keys[i + 1];
      utils$1.expand(r, state.tmp, 0);
      keyL ^= state.tmp[0];
      keyR ^= state.tmp[1];
      var s = utils$1.substitute(keyL, keyR);
      var f = utils$1.permute(s);
      var t = r;
      r = (l ^ f) >>> 0;
      l = t;
    }
    utils$1.rip(r, l, out, off);
  };
  DES$2.prototype._decrypt = function _decrypt(state, lStart, rStart, out, off) {
    var l = rStart;
    var r = lStart;
    for (var i = state.keys.length - 2; i >= 0; i -= 2) {
      var keyL = state.keys[i];
      var keyR = state.keys[i + 1];
      utils$1.expand(l, state.tmp, 0);
      keyL ^= state.tmp[0];
      keyR ^= state.tmp[1];
      var s = utils$1.substitute(keyL, keyR);
      var f = utils$1.permute(s);
      var t = l;
      l = (r ^ f) >>> 0;
      r = t;
    }
    utils$1.rip(l, r, out, off);
  };
  var cbc = {};
  var assert$1 = minimalisticAssert;
  var inherits$1 = inheritsExports;
  var proto = {};
  function CBCState(iv) {
    assert$1.equal(iv.length, 8, 'Invalid IV length');
    this.iv = new Array(8);
    for (var i = 0; i < this.iv.length; i++) this.iv[i] = iv[i];
  }
  function instantiate(Base) {
    function CBC(options) {
      Base.call(this, options);
      this._cbcInit();
    }
    inherits$1(CBC, Base);
    var keys = Object.keys(proto);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      CBC.prototype[key] = proto[key];
    }
    CBC.create = function create(options) {
      return new CBC(options);
    };
    return CBC;
  }
  cbc.instantiate = instantiate;
  proto._cbcInit = function _cbcInit() {
    var state = new CBCState(this.options.iv);
    this._cbcState = state;
  };
  proto._update = function _update(inp, inOff, out, outOff) {
    var state = this._cbcState;
    var superProto = this.constructor.super_.prototype;
    var iv = state.iv;
    if (this.type === 'encrypt') {
      for (var i = 0; i < this.blockSize; i++) iv[i] ^= inp[inOff + i];
      superProto._update.call(this, iv, 0, out, outOff);
      for (var i = 0; i < this.blockSize; i++) iv[i] = out[outOff + i];
    } else {
      superProto._update.call(this, inp, inOff, out, outOff);
      for (var i = 0; i < this.blockSize; i++) out[outOff + i] ^= iv[i];
      for (var i = 0; i < this.blockSize; i++) iv[i] = inp[inOff + i];
    }
  };
  var assert = minimalisticAssert;
  var inherits = inheritsExports;
  var Cipher$1 = cipher;
  var DES$1 = des$1;
  function EDEState(type, key) {
    assert.equal(key.length, 24, 'Invalid key length');
    var k1 = key.slice(0, 8);
    var k2 = key.slice(8, 16);
    var k3 = key.slice(16, 24);
    if (type === 'encrypt') {
      this.ciphers = [DES$1.create({
        type: 'encrypt',
        key: k1
      }), DES$1.create({
        type: 'decrypt',
        key: k2
      }), DES$1.create({
        type: 'encrypt',
        key: k3
      })];
    } else {
      this.ciphers = [DES$1.create({
        type: 'decrypt',
        key: k3
      }), DES$1.create({
        type: 'encrypt',
        key: k2
      }), DES$1.create({
        type: 'decrypt',
        key: k1
      })];
    }
  }
  function EDE$1(options) {
    Cipher$1.call(this, options);
    var state = new EDEState(this.type, this.options.key);
    this._edeState = state;
  }
  inherits(EDE$1, Cipher$1);
  var ede = EDE$1;
  EDE$1.create = function create(options) {
    return new EDE$1(options);
  };
  EDE$1.prototype._update = function _update(inp, inOff, out, outOff) {
    var state = this._edeState;
    state.ciphers[0]._update(inp, inOff, out, outOff);
    state.ciphers[1]._update(out, outOff, out, outOff);
    state.ciphers[2]._update(out, outOff, out, outOff);
  };
  EDE$1.prototype._pad = DES$1.prototype._pad;
  EDE$1.prototype._unpad = DES$1.prototype._unpad;
  var utils = des$2.utils = utils$2;
  var Cipher = des$2.Cipher = cipher;
  var DES = des$2.DES = des$1;
  var CBC = des$2.CBC = cbc;
  var EDE = des$2.EDE = ede;
  var des = _mergeNamespaces({
    __proto__: null,
    CBC: CBC,
    Cipher: Cipher,
    DES: DES,
    EDE: EDE,
    default: des$2,
    utils: utils
  }, [des$2]);
  var DesCryptoKey = function (_CryptoKey7) {
    _inherits(DesCryptoKey, _CryptoKey7);
    function DesCryptoKey(algorithm, extractable, usages, raw) {
      var _this102;
      _classCallCheck(this, DesCryptoKey);
      _this102 = _callSuper(this, DesCryptoKey, [algorithm, extractable, "secret", usages]);
      _this102.raw = raw;
      return _this102;
    }
    _createClass(DesCryptoKey, [{
      key: "toJSON",
      value: function toJSON() {
        var jwk = {
          kty: "oct",
          alg: this.getJwkAlgorithm(),
          k: Convert.ToBase64Url(this.raw),
          ext: this.extractable,
          key_ops: this.usages
        };
        return jwk;
      }
    }, {
      key: "getJwkAlgorithm",
      value: function getJwkAlgorithm() {
        switch (this.algorithm.name.toUpperCase()) {
          case "DES-CBC":
            return "DES-CBC";
          case "DES-EDE3-CBC":
            return "3DES-CBC";
          default:
            throw new AlgorithmError("Unsupported algorithm name");
        }
      }
    }]);
    return DesCryptoKey;
  }(CryptoKey);
  var DesCrypto = function () {
    function DesCrypto() {
      _classCallCheck(this, DesCrypto);
    }
    _createClass(DesCrypto, null, [{
      key: "checkLib",
      value: function checkLib() {
        if (typeof des === "undefined") {
          throw new OperationError("Cannot implement DES mechanism. Add 'https://peculiarventures.github.io/pv-webcrypto-tests/src/des.js' script to your project");
        }
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key) {
        if (!(key instanceof DesCryptoKey)) {
          throw new TypeError("key: Is not DesCryptoKey");
        }
      }
    }, {
      key: "generateKey",
      value: function generateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee122() {
          var raw;
          return _regeneratorRuntime().wrap(function _callee122$(_context122) {
            while (1) switch (_context122.prev = _context122.next) {
              case 0:
                this.checkLib();
                raw = exports.nativeCrypto.getRandomValues(new Uint8Array(algorithm.length / 8));
                return _context122.abrupt("return", new DesCryptoKey(algorithm, extractable, keyUsages, raw));
              case 3:
              case "end":
                return _context122.stop();
            }
          }, _callee122, this);
        }));
      }
    }, {
      key: "exportKey",
      value: function exportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee123() {
          return _regeneratorRuntime().wrap(function _callee123$(_context123) {
            while (1) switch (_context123.prev = _context123.next) {
              case 0:
                this.checkLib();
                _context123.t0 = format;
                _context123.next = _context123.t0 === "jwk" ? 4 : _context123.t0 === "raw" ? 5 : 6;
                break;
              case 4:
                return _context123.abrupt("return", key.toJSON());
              case 5:
                return _context123.abrupt("return", key.raw.buffer);
              case 6:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
              case 7:
              case "end":
                return _context123.stop();
            }
          }, _callee123, this);
        }));
      }
    }, {
      key: "importKey",
      value: function importKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee124() {
          var raw, key;
          return _regeneratorRuntime().wrap(function _callee124$(_context124) {
            while (1) switch (_context124.prev = _context124.next) {
              case 0:
                this.checkLib();
                if (isJWK(keyData)) {
                  raw = Convert.FromBase64Url(keyData.k);
                } else {
                  raw = BufferSourceConverter.toArrayBuffer(keyData);
                }
                if (!(algorithm.name === "DES-CBC" && raw.byteLength !== 8 || algorithm.name === "DES-EDE3-CBC" && raw.byteLength !== 24)) {
                  _context124.next = 4;
                  break;
                }
                throw new OperationError("keyData: Is wrong key length");
              case 4:
                key = new DesCryptoKey({
                  name: algorithm.name,
                  length: raw.byteLength << 3
                }, extractable, keyUsages, new Uint8Array(raw));
                return _context124.abrupt("return", key);
              case 6:
              case "end":
                return _context124.stop();
            }
          }, _callee124, this);
        }));
      }
    }, {
      key: "encrypt",
      value: function encrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee125() {
          return _regeneratorRuntime().wrap(function _callee125$(_context125) {
            while (1) switch (_context125.prev = _context125.next) {
              case 0:
                return _context125.abrupt("return", this.cipher(algorithm, key, data, true));
              case 1:
              case "end":
                return _context125.stop();
            }
          }, _callee125, this);
        }));
      }
    }, {
      key: "decrypt",
      value: function decrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee126() {
          return _regeneratorRuntime().wrap(function _callee126$(_context126) {
            while (1) switch (_context126.prev = _context126.next) {
              case 0:
                return _context126.abrupt("return", this.cipher(algorithm, key, data, false));
              case 1:
              case "end":
                return _context126.stop();
            }
          }, _callee126, this);
        }));
      }
    }, {
      key: "cipher",
      value: function cipher(algorithm, key, data, encrypt) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee127() {
          var type, DesCipher, iv, enc;
          return _regeneratorRuntime().wrap(function _callee127$(_context127) {
            while (1) switch (_context127.prev = _context127.next) {
              case 0:
                this.checkLib();
                type = encrypt ? "encrypt" : "decrypt";
                iv = BufferSourceConverter.toUint8Array(algorithm.iv);
                _context127.t0 = algorithm.name.toUpperCase();
                _context127.next = _context127.t0 === "DES-CBC" ? 6 : _context127.t0 === "DES-EDE3-CBC" ? 8 : 10;
                break;
              case 6:
                DesCipher = CBC.instantiate(DES).create({
                  key: key.raw,
                  type: type,
                  iv: iv
                });
                return _context127.abrupt("break", 11);
              case 8:
                DesCipher = CBC.instantiate(EDE).create({
                  key: key.raw,
                  type: type,
                  iv: iv
                });
                return _context127.abrupt("break", 11);
              case 10:
                throw new OperationError("algorithm: Is not recognized");
              case 11:
                enc = DesCipher.update(new Uint8Array(data)).concat(DesCipher.final());
                return _context127.abrupt("return", new Uint8Array(enc).buffer);
              case 13:
              case "end":
                return _context127.stop();
            }
          }, _callee127, this);
        }));
      }
    }]);
    return DesCrypto;
  }();
  var DesCbcProvider = function (_DesProvider) {
    _inherits(DesCbcProvider, _DesProvider);
    function DesCbcProvider() {
      var _this103;
      _classCallCheck(this, DesCbcProvider);
      _this103 = _callSuper(this, DesCbcProvider, arguments);
      _this103.keySizeBits = 64;
      _this103.ivSize = 8;
      _this103.name = "DES-CBC";
      return _this103;
    }
    _createClass(DesCbcProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee128() {
          return _regeneratorRuntime().wrap(function _callee128$(_context128) {
            while (1) switch (_context128.prev = _context128.next) {
              case 0:
                return _context128.abrupt("return", DesCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context128.stop();
            }
          }, _callee128);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee129() {
          return _regeneratorRuntime().wrap(function _callee129$(_context129) {
            while (1) switch (_context129.prev = _context129.next) {
              case 0:
                return _context129.abrupt("return", DesCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context129.stop();
            }
          }, _callee129);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee130() {
          return _regeneratorRuntime().wrap(function _callee130$(_context130) {
            while (1) switch (_context130.prev = _context130.next) {
              case 0:
                return _context130.abrupt("return", DesCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context130.stop();
            }
          }, _callee130);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee131() {
          return _regeneratorRuntime().wrap(function _callee131$(_context131) {
            while (1) switch (_context131.prev = _context131.next) {
              case 0:
                return _context131.abrupt("return", DesCrypto.encrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context131.stop();
            }
          }, _callee131);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee132() {
          return _regeneratorRuntime().wrap(function _callee132$(_context132) {
            while (1) switch (_context132.prev = _context132.next) {
              case 0:
                return _context132.abrupt("return", DesCrypto.decrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context132.stop();
            }
          }, _callee132);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(DesCbcProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        DesCrypto.checkCryptoKey(key);
      }
    }]);
    return DesCbcProvider;
  }(DesProvider);
  var DesEde3CbcProvider = function (_DesProvider2) {
    _inherits(DesEde3CbcProvider, _DesProvider2);
    function DesEde3CbcProvider() {
      var _this104;
      _classCallCheck(this, DesEde3CbcProvider);
      _this104 = _callSuper(this, DesEde3CbcProvider, arguments);
      _this104.keySizeBits = 192;
      _this104.ivSize = 8;
      _this104.name = "DES-EDE3-CBC";
      return _this104;
    }
    _createClass(DesEde3CbcProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee133() {
          return _regeneratorRuntime().wrap(function _callee133$(_context133) {
            while (1) switch (_context133.prev = _context133.next) {
              case 0:
                return _context133.abrupt("return", DesCrypto.generateKey(algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context133.stop();
            }
          }, _callee133);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee134() {
          return _regeneratorRuntime().wrap(function _callee134$(_context134) {
            while (1) switch (_context134.prev = _context134.next) {
              case 0:
                return _context134.abrupt("return", DesCrypto.exportKey(format, key));
              case 1:
              case "end":
                return _context134.stop();
            }
          }, _callee134);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee135() {
          return _regeneratorRuntime().wrap(function _callee135$(_context135) {
            while (1) switch (_context135.prev = _context135.next) {
              case 0:
                return _context135.abrupt("return", DesCrypto.importKey(format, keyData, algorithm, extractable, keyUsages));
              case 1:
              case "end":
                return _context135.stop();
            }
          }, _callee135);
        }));
      }
    }, {
      key: "onEncrypt",
      value: function onEncrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee136() {
          return _regeneratorRuntime().wrap(function _callee136$(_context136) {
            while (1) switch (_context136.prev = _context136.next) {
              case 0:
                return _context136.abrupt("return", DesCrypto.encrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context136.stop();
            }
          }, _callee136);
        }));
      }
    }, {
      key: "onDecrypt",
      value: function onDecrypt(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee137() {
          return _regeneratorRuntime().wrap(function _callee137$(_context137) {
            while (1) switch (_context137.prev = _context137.next) {
              case 0:
                return _context137.abrupt("return", DesCrypto.decrypt(algorithm, key, data));
              case 1:
              case "end":
                return _context137.stop();
            }
          }, _callee137);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(DesEde3CbcProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        DesCrypto.checkCryptoKey(key);
      }
    }]);
    return DesEde3CbcProvider;
  }(DesProvider);
  var JsonBase64UrlConverter = {
    fromJSON: function fromJSON(value) {
      return Buffer.from(Convert.FromBase64Url(value));
    },
    toJSON: function toJSON(value) {
      return Convert.ToBase64Url(value);
    }
  };
  var HmacCryptoKey = function (_CryptoKey8) {
    _inherits(HmacCryptoKey, _CryptoKey8);
    function HmacCryptoKey() {
      var _this105;
      var algorithm = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
        name: "HMAC"
      };
      var extractable = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var usages = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
      var data = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : new Uint8Array(0);
      _classCallCheck(this, HmacCryptoKey);
      _this105 = _callSuper(this, HmacCryptoKey, [algorithm, extractable, "secret", usages]);
      _this105.kty = "oct";
      _this105.data = data;
      return _this105;
    }
    _createClass(HmacCryptoKey, [{
      key: "alg",
      get: function get() {
        var hash = this.algorithm.hash.name.toUpperCase();
        return "HS".concat(hash.replace("SHA-", ""));
      },
      set: function set(value) {}
    }]);
    return HmacCryptoKey;
  }(CryptoKey);
  __decorate([JsonProp({
    name: "ext",
    type: JsonPropTypes.Boolean,
    optional: true
  })], HmacCryptoKey.prototype, "extractable", void 0);
  __decorate([JsonProp({
    name: "key_ops",
    type: JsonPropTypes.String,
    repeated: true,
    optional: true
  })], HmacCryptoKey.prototype, "usages", void 0);
  __decorate([JsonProp({
    name: "k",
    converter: JsonBase64UrlConverter
  })], HmacCryptoKey.prototype, "data", void 0);
  __decorate([JsonProp({
    type: JsonPropTypes.String
  })], HmacCryptoKey.prototype, "kty", void 0);
  __decorate([JsonProp({
    type: JsonPropTypes.String
  })], HmacCryptoKey.prototype, "alg", null);
  var HmacProvider = function (_HmacProvider$) {
    _inherits(HmacProvider, _HmacProvider$);
    function HmacProvider() {
      _classCallCheck(this, HmacProvider);
      return _callSuper(this, HmacProvider, arguments);
    }
    _createClass(HmacProvider, [{
      key: "onGenerateKey",
      value: function onGenerateKey(algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee138() {
          var length, raw, key;
          return _regeneratorRuntime().wrap(function _callee138$(_context138) {
            while (1) switch (_context138.prev = _context138.next) {
              case 0:
                length = algorithm.length || this.getDefaultLength(algorithm.hash.name);
                raw = exports.nativeCrypto.getRandomValues(new Uint8Array(length >> 3));
                key = new HmacCryptoKey(algorithm, extractable, keyUsages, raw);
                return _context138.abrupt("return", key);
              case 4:
              case "end":
                return _context138.stop();
            }
          }, _callee138, this);
        }));
      }
    }, {
      key: "onSign",
      value: function onSign(algorithm, key, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee139() {
          var fn, result;
          return _regeneratorRuntime().wrap(function _callee139$(_context139) {
            while (1) switch (_context139.prev = _context139.next) {
              case 0:
                _context139.t0 = key.algorithm.hash.name.toUpperCase();
                _context139.next = _context139.t0 === "SHA-1" ? 3 : _context139.t0 === "SHA-256" ? 5 : _context139.t0 === "SHA-512" ? 7 : 9;
                break;
              case 3:
                fn = asmCrypto__namespace.HmacSha1;
                return _context139.abrupt("break", 10);
              case 5:
                fn = asmCrypto__namespace.HmacSha256;
                return _context139.abrupt("break", 10);
              case 7:
                fn = asmCrypto__namespace.HmacSha512;
                return _context139.abrupt("break", 10);
              case 9:
                throw new OperationError("key.algorithm.hash: Is not recognized");
              case 10:
                result = new fn(key.data).process(BufferSourceConverter.toUint8Array(data)).finish().result;
                return _context139.abrupt("return", BufferSourceConverter.toArrayBuffer(result));
              case 12:
              case "end":
                return _context139.stop();
            }
          }, _callee139);
        }));
      }
    }, {
      key: "onVerify",
      value: function onVerify(algorithm, key, signature, data) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee140() {
          var signature2;
          return _regeneratorRuntime().wrap(function _callee140$(_context140) {
            while (1) switch (_context140.prev = _context140.next) {
              case 0:
                _context140.next = 2;
                return this.onSign(algorithm, key, data);
              case 2:
                signature2 = _context140.sent;
                return _context140.abrupt("return", Convert.ToHex(signature2) === Convert.ToHex(signature));
              case 4:
              case "end":
                return _context140.stop();
            }
          }, _callee140, this);
        }));
      }
    }, {
      key: "onImportKey",
      value: function onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee141() {
          var key;
          return _regeneratorRuntime().wrap(function _callee141$(_context141) {
            while (1) switch (_context141.prev = _context141.next) {
              case 0:
                _context141.t0 = format.toLowerCase();
                _context141.next = _context141.t0 === "jwk" ? 3 : _context141.t0 === "raw" ? 5 : 9;
                break;
              case 3:
                key = JsonParser.fromJSON(keyData, {
                  targetSchema: HmacCryptoKey
                });
                return _context141.abrupt("break", 10);
              case 5:
                if (BufferSourceConverter.isBufferSource(keyData)) {
                  _context141.next = 7;
                  break;
                }
                throw new TypeError("keyData: Is not ArrayBuffer or ArrayBufferView");
              case 7:
                key = new HmacCryptoKey(algorithm, extractable, keyUsages, BufferSourceConverter.toUint8Array(keyData));
                return _context141.abrupt("break", 10);
              case 9:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
              case 10:
                key.algorithm = {
                  hash: {
                    name: algorithm.hash.name
                  },
                  name: this.name,
                  length: key.data.length << 3
                };
                key.extractable = extractable;
                key.usages = keyUsages;
                return _context141.abrupt("return", key);
              case 14:
              case "end":
                return _context141.stop();
            }
          }, _callee141, this);
        }));
      }
    }, {
      key: "onExportKey",
      value: function onExportKey(format, key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee142() {
          var jwk;
          return _regeneratorRuntime().wrap(function _callee142$(_context142) {
            while (1) switch (_context142.prev = _context142.next) {
              case 0:
                _context142.t0 = format.toLowerCase();
                _context142.next = _context142.t0 === "jwk" ? 3 : _context142.t0 === "raw" ? 5 : 6;
                break;
              case 3:
                jwk = JsonSerializer.toJSON(key);
                return _context142.abrupt("return", jwk);
              case 5:
                return _context142.abrupt("return", new Uint8Array(key.data).buffer);
              case 6:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
              case 7:
              case "end":
                return _context142.stop();
            }
          }, _callee142);
        }));
      }
    }, {
      key: "checkCryptoKey",
      value: function checkCryptoKey(key, keyUsage) {
        _get(_getPrototypeOf(HmacProvider.prototype), "checkCryptoKey", this).call(this, key, keyUsage);
        if (!(key instanceof HmacCryptoKey)) {
          throw new TypeError("key: Is not HMAC CryptoKey");
        }
      }
    }]);
    return HmacProvider;
  }(HmacProvider$1);
  var _WrappedNativeCryptoKey_nativeKey;
  var WrappedNativeCryptoKey = function (_CryptoKey9) {
    _inherits(WrappedNativeCryptoKey, _CryptoKey9);
    function WrappedNativeCryptoKey(algorithm, extractable, type, usages, nativeKey) {
      var _this106;
      _classCallCheck(this, WrappedNativeCryptoKey);
      _this106 = _callSuper(this, WrappedNativeCryptoKey, [algorithm, extractable, type, usages]);
      _WrappedNativeCryptoKey_nativeKey.set(_assertThisInitialized(_this106), void 0);
      __classPrivateFieldSet(_assertThisInitialized(_this106), _WrappedNativeCryptoKey_nativeKey, nativeKey, "f");
      return _this106;
    }
    _createClass(WrappedNativeCryptoKey, [{
      key: "getNative",
      value: function getNative() {
        return __classPrivateFieldGet(this, _WrappedNativeCryptoKey_nativeKey, "f");
      }
    }]);
    return WrappedNativeCryptoKey;
  }(CryptoKey);
  _WrappedNativeCryptoKey_nativeKey = new WeakMap();
  var SubtleCrypto = function (_SubtleCrypto$) {
    _inherits(SubtleCrypto, _SubtleCrypto$);
    function SubtleCrypto() {
      var _this107;
      _classCallCheck(this, SubtleCrypto);
      _this107 = _callSuper(this, SubtleCrypto);
      _this107.browserInfo = BrowserInfo();
      _this107.providers.set(new AesCbcProvider());
      _this107.providers.set(new AesCtrProvider());
      _this107.providers.set(new AesEcbProvider());
      _this107.providers.set(new AesGcmProvider());
      _this107.providers.set(new AesKwProvider());
      _this107.providers.set(new DesCbcProvider());
      _this107.providers.set(new DesEde3CbcProvider());
      _this107.providers.set(new RsaSsaProvider());
      _this107.providers.set(new RsaPssProvider());
      _this107.providers.set(new RsaOaepProvider());
      _this107.providers.set(new RsaEsProvider());
      _this107.providers.set(new EcdsaProvider());
      _this107.providers.set(new EcdhProvider());
      _this107.providers.set(new Sha1Provider());
      _this107.providers.set(new Sha256Provider());
      _this107.providers.set(new Sha512Provider());
      _this107.providers.set(new Pbkdf2Provider());
      _this107.providers.set(new HmacProvider());
      _this107.providers.set(new EdDsaProvider());
      _this107.providers.set(new EcdhEsProvider());
      _this107.providers.set(new Sha3256Provider());
      _this107.providers.set(new Sha3384Provider());
      _this107.providers.set(new Sha3512Provider());
      _this107.providers.set(new Shake128Provider());
      _this107.providers.set(new Shake256Provider());
      return _this107;
    }
    _createClass(SubtleCrypto, [{
      key: "digest",
      value: function digest() {
        for (var _len31 = arguments.length, args = new Array(_len31), _key34 = 0; _key34 < _len31; _key34++) {
          args[_key34] = arguments[_key34];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee143() {
          return _regeneratorRuntime().wrap(function _callee143$(_context143) {
            while (1) switch (_context143.prev = _context143.next) {
              case 0:
                return _context143.abrupt("return", this.wrapNative.apply(this, ["digest"].concat(args)));
              case 1:
              case "end":
                return _context143.stop();
            }
          }, _callee143, this);
        }));
      }
    }, {
      key: "importKey",
      value: function importKey() {
        for (var _len32 = arguments.length, args = new Array(_len32), _key35 = 0; _key35 < _len32; _key35++) {
          args[_key35] = arguments[_key35];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee144() {
          return _regeneratorRuntime().wrap(function _callee144$(_context144) {
            while (1) switch (_context144.prev = _context144.next) {
              case 0:
                this.fixFirefoxEcImportPkcs8(args);
                return _context144.abrupt("return", this.wrapNative.apply(this, ["importKey"].concat(args)));
              case 2:
              case "end":
                return _context144.stop();
            }
          }, _callee144, this);
        }));
      }
    }, {
      key: "exportKey",
      value: function exportKey() {
        for (var _len33 = arguments.length, args = new Array(_len33), _key36 = 0; _key36 < _len33; _key36++) {
          args[_key36] = arguments[_key36];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee145() {
          return _regeneratorRuntime().wrap(function _callee145$(_context145) {
            while (1) switch (_context145.prev = _context145.next) {
              case 0:
                _context145.next = 2;
                return this.fixFirefoxEcExportPkcs8(args);
              case 2:
                _context145.t0 = _context145.sent;
                if (_context145.t0) {
                  _context145.next = 7;
                  break;
                }
                _context145.next = 6;
                return this.wrapNative.apply(this, ["exportKey"].concat(args));
              case 6:
                _context145.t0 = _context145.sent;
              case 7:
                return _context145.abrupt("return", _context145.t0);
              case 8:
              case "end":
                return _context145.stop();
            }
          }, _callee145, this);
        }));
      }
    }, {
      key: "generateKey",
      value: function generateKey() {
        for (var _len34 = arguments.length, args = new Array(_len34), _key37 = 0; _key37 < _len34; _key37++) {
          args[_key37] = arguments[_key37];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee146() {
          return _regeneratorRuntime().wrap(function _callee146$(_context146) {
            while (1) switch (_context146.prev = _context146.next) {
              case 0:
                return _context146.abrupt("return", this.wrapNative.apply(this, ["generateKey"].concat(args)));
              case 1:
              case "end":
                return _context146.stop();
            }
          }, _callee146, this);
        }));
      }
    }, {
      key: "sign",
      value: function sign() {
        for (var _len35 = arguments.length, args = new Array(_len35), _key38 = 0; _key38 < _len35; _key38++) {
          args[_key38] = arguments[_key38];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee147() {
          return _regeneratorRuntime().wrap(function _callee147$(_context147) {
            while (1) switch (_context147.prev = _context147.next) {
              case 0:
                return _context147.abrupt("return", this.wrapNative.apply(this, ["sign"].concat(args)));
              case 1:
              case "end":
                return _context147.stop();
            }
          }, _callee147, this);
        }));
      }
    }, {
      key: "verify",
      value: function verify() {
        for (var _len36 = arguments.length, args = new Array(_len36), _key39 = 0; _key39 < _len36; _key39++) {
          args[_key39] = arguments[_key39];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee148() {
          return _regeneratorRuntime().wrap(function _callee148$(_context148) {
            while (1) switch (_context148.prev = _context148.next) {
              case 0:
                return _context148.abrupt("return", this.wrapNative.apply(this, ["verify"].concat(args)));
              case 1:
              case "end":
                return _context148.stop();
            }
          }, _callee148, this);
        }));
      }
    }, {
      key: "encrypt",
      value: function encrypt() {
        for (var _len37 = arguments.length, args = new Array(_len37), _key40 = 0; _key40 < _len37; _key40++) {
          args[_key40] = arguments[_key40];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee149() {
          return _regeneratorRuntime().wrap(function _callee149$(_context149) {
            while (1) switch (_context149.prev = _context149.next) {
              case 0:
                return _context149.abrupt("return", this.wrapNative.apply(this, ["encrypt"].concat(args)));
              case 1:
              case "end":
                return _context149.stop();
            }
          }, _callee149, this);
        }));
      }
    }, {
      key: "decrypt",
      value: function decrypt() {
        for (var _len38 = arguments.length, args = new Array(_len38), _key41 = 0; _key41 < _len38; _key41++) {
          args[_key41] = arguments[_key41];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee150() {
          return _regeneratorRuntime().wrap(function _callee150$(_context150) {
            while (1) switch (_context150.prev = _context150.next) {
              case 0:
                return _context150.abrupt("return", this.wrapNative.apply(this, ["decrypt"].concat(args)));
              case 1:
              case "end":
                return _context150.stop();
            }
          }, _callee150, this);
        }));
      }
    }, {
      key: "wrapKey",
      value: function wrapKey() {
        for (var _len39 = arguments.length, args = new Array(_len39), _key42 = 0; _key42 < _len39; _key42++) {
          args[_key42] = arguments[_key42];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee151() {
          return _regeneratorRuntime().wrap(function _callee151$(_context151) {
            while (1) switch (_context151.prev = _context151.next) {
              case 0:
                return _context151.abrupt("return", this.wrapNative.apply(this, ["wrapKey"].concat(args)));
              case 1:
              case "end":
                return _context151.stop();
            }
          }, _callee151, this);
        }));
      }
    }, {
      key: "unwrapKey",
      value: function unwrapKey() {
        for (var _len40 = arguments.length, args = new Array(_len40), _key43 = 0; _key43 < _len40; _key43++) {
          args[_key43] = arguments[_key43];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee152() {
          return _regeneratorRuntime().wrap(function _callee152$(_context152) {
            while (1) switch (_context152.prev = _context152.next) {
              case 0:
                return _context152.abrupt("return", this.wrapNative.apply(this, ["unwrapKey"].concat(args)));
              case 1:
              case "end":
                return _context152.stop();
            }
          }, _callee152, this);
        }));
      }
    }, {
      key: "deriveBits",
      value: function deriveBits() {
        for (var _len41 = arguments.length, args = new Array(_len41), _key44 = 0; _key44 < _len41; _key44++) {
          args[_key44] = arguments[_key44];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee153() {
          return _regeneratorRuntime().wrap(function _callee153$(_context153) {
            while (1) switch (_context153.prev = _context153.next) {
              case 0:
                return _context153.abrupt("return", this.wrapNative.apply(this, ["deriveBits"].concat(args)));
              case 1:
              case "end":
                return _context153.stop();
            }
          }, _callee153, this);
        }));
      }
    }, {
      key: "deriveKey",
      value: function deriveKey() {
        for (var _len42 = arguments.length, args = new Array(_len42), _key45 = 0; _key45 < _len42; _key45++) {
          args[_key45] = arguments[_key45];
        }
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee154() {
          return _regeneratorRuntime().wrap(function _callee154$(_context154) {
            while (1) switch (_context154.prev = _context154.next) {
              case 0:
                return _context154.abrupt("return", this.wrapNative.apply(this, ["deriveKey"].concat(args)));
              case 1:
              case "end":
                return _context154.stop();
            }
          }, _callee154, this);
        }));
      }
    }, {
      key: "wrapNative",
      value: function wrapNative(method) {
        var _this108 = this;
        for (var _len43 = arguments.length, args = new Array(_len43 > 1 ? _len43 - 1 : 0), _key46 = 1; _key46 < _len43; _key46++) {
          args[_key46 - 1] = arguments[_key46];
        }
        var _superIndex = function _superIndex(name) {
          return _get(_getPrototypeOf(SubtleCrypto.prototype), name, _this108);
        };
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee155() {
          var nativeArgs, res, data, keyData, _res, _data2, _keyData2, _res2, _data3, _res3, _i15, _args156, arg, i, _arg, fn;
          return _regeneratorRuntime().wrap(function _callee155$(_context155) {
            while (1) switch (_context155.prev = _context155.next) {
              case 0:
                if (~["generateKey", "unwrapKey", "deriveKey", "importKey"].indexOf(method)) {
                  this.fixAlgorithmName(args);
                }
                _context155.prev = 1;
                if (!(method !== "digest" || !args.some(function (a) {
                  return a instanceof CryptoKey;
                }))) {
                  _context155.next = 9;
                  break;
                }
                nativeArgs = this.fixNativeArguments(method, args);
                Debug.info("Call native '".concat(method, "' method"), nativeArgs);
                _context155.next = 7;
                return exports.nativeSubtle[method].apply(exports.nativeSubtle, nativeArgs);
              case 7:
                res = _context155.sent;
                return _context155.abrupt("return", this.fixNativeResult(method, args, res));
              case 9:
                _context155.next = 14;
                break;
              case 11:
                _context155.prev = 11;
                _context155.t0 = _context155["catch"](1);
                Debug.warn("Error on native '".concat(method, "' calling. ").concat(_context155.t0.message), _context155.t0);
              case 14:
                if (!(method === "wrapKey")) {
                  _context155.next = 30;
                  break;
                }
                _context155.prev = 15;
                Debug.info("Trying to wrap key by using native functions", args);
                _context155.next = 19;
                return this.exportKey(args[0], args[1]);
              case 19:
                data = _context155.sent;
                keyData = args[0] === "jwk" ? Convert.FromUtf8String(JSON.stringify(data)) : data;
                _context155.next = 23;
                return this.encrypt(args[3], args[2], keyData);
              case 23:
                _res = _context155.sent;
                return _context155.abrupt("return", _res);
              case 27:
                _context155.prev = 27;
                _context155.t1 = _context155["catch"](15);
                Debug.warn("Cannot wrap key by native functions. ".concat(_context155.t1.message), _context155.t1);
              case 30:
                if (!(method === "unwrapKey")) {
                  _context155.next = 46;
                  break;
                }
                _context155.prev = 31;
                Debug.info("Trying to unwrap key by using native functions", args);
                _context155.next = 35;
                return this.decrypt(args[3], args[2], args[1]);
              case 35:
                _data2 = _context155.sent;
                _keyData2 = args[0] === "jwk" ? JSON.parse(Convert.ToUtf8String(_data2)) : _data2;
                _context155.next = 39;
                return this.importKey(args[0], _keyData2, args[4], args[5], args[6]);
              case 39:
                _res2 = _context155.sent;
                return _context155.abrupt("return", _res2);
              case 43:
                _context155.prev = 43;
                _context155.t2 = _context155["catch"](31);
                Debug.warn("Cannot unwrap key by native functions. ".concat(_context155.t2.message), _context155.t2);
              case 46:
                if (!(method === "deriveKey")) {
                  _context155.next = 61;
                  break;
                }
                _context155.prev = 47;
                Debug.info("Trying to derive key by using native functions", args);
                _context155.next = 51;
                return this.deriveBits(args[0], args[1], args[2].length);
              case 51:
                _data3 = _context155.sent;
                _context155.next = 54;
                return this.importKey("raw", _data3, args[2], args[3], args[4]);
              case 54:
                _res3 = _context155.sent;
                return _context155.abrupt("return", _res3);
              case 58:
                _context155.prev = 58;
                _context155.t3 = _context155["catch"](47);
                Debug.warn("Cannot derive key by native functions. ".concat(_context155.t3.message), _context155.t3);
              case 61:
                if (!(method === "deriveBits" || method === "deriveKey")) {
                  _context155.next = 72;
                  break;
                }
                _i15 = 0, _args156 = args;
              case 63:
                if (!(_i15 < _args156.length)) {
                  _context155.next = 72;
                  break;
                }
                arg = _args156[_i15];
                if (!(_typeof(arg) === "object" && arg.public && SubtleCrypto.isAnotherKey(arg.public))) {
                  _context155.next = 69;
                  break;
                }
                _context155.next = 68;
                return this.castKey(arg.public);
              case 68:
                arg.public = _context155.sent;
              case 69:
                _i15++;
                _context155.next = 63;
                break;
              case 72:
                i = 0;
              case 73:
                if (!(i < args.length)) {
                  _context155.next = 82;
                  break;
                }
                _arg = args[i];
                if (!SubtleCrypto.isAnotherKey(_arg)) {
                  _context155.next = 79;
                  break;
                }
                _context155.next = 78;
                return this.castKey(_arg);
              case 78:
                args[i] = _context155.sent;
              case 79:
                i++;
                _context155.next = 73;
                break;
              case 82:
                fn = _superIndex(method);
                if (!(typeof fn === "function")) {
                  _context155.next = 85;
                  break;
                }
                return _context155.abrupt("return", fn.apply(this, args));
              case 85:
                throw new Error("Incorrect type of 'method'. Must be 'function'.");
              case 86:
              case "end":
                return _context155.stop();
            }
          }, _callee155, this, [[1, 11], [15, 27], [31, 43], [47, 58]]);
        }));
      }
    }, {
      key: "fixNativeArguments",
      value: function fixNativeArguments(method, args) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        var res = _toConsumableArray(args);
        if (method === "importKey") {
          if (this.browserInfo.name === Browser.IE && ((_b = (_a = res[0]) === null || _a === void 0 ? void 0 : _a.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(_a)) === "jwk" && !BufferSourceConverter.isBufferSource(res[1])) {
            res[1] = Convert.FromUtf8String(JSON.stringify(res[1]));
          }
        }
        if (this.browserInfo.name === Browser.IE && args[1] instanceof WrappedNativeCryptoKey) {
          switch (method) {
            case "sign":
            case "verify":
            case "encrypt":
            case "decrypt":
              res[0] = Object.assign(Object.assign({}, this.prepareAlgorithm(res[0])), {
                hash: (_e = (_d = (_c = res[1]) === null || _c === void 0 ? void 0 : _c.algorithm) === null || _d === void 0 ? void 0 : _d.hash) === null || _e === void 0 ? void 0 : _e.name
              });
              break;
            case "wrapKey":
            case "unwrapKey":
              res[4] = Object.assign(Object.assign({}, this.prepareAlgorithm(res[4])), {
                hash: (_h = (_g = (_f = res[3]) === null || _f === void 0 ? void 0 : _f.algorithm) === null || _g === void 0 ? void 0 : _g.hash) === null || _h === void 0 ? void 0 : _h.name
              });
              break;
          }
        }
        for (var i = 0; i < res.length; i++) {
          var arg = res[i];
          if (arg instanceof WrappedNativeCryptoKey) {
            res[i] = arg.getNative();
          }
        }
        return res;
      }
    }, {
      key: "fixNativeResult",
      value: function fixNativeResult(method, args, res) {
        var _a, _b;
        if (this.browserInfo.name === Browser.IE) {
          if (method === "exportKey") {
            if (((_b = (_a = args[0]) === null || _a === void 0 ? void 0 : _a.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(_a)) === "jwk" && res instanceof ArrayBuffer) {
              return JSON.parse(Convert.ToUtf8String(res));
            }
          }
          if ("privateKey" in res) {
            var privateKeyUsages = ["sign", "decrypt", "unwrapKey", "deriveKey", "deriveBits"];
            var publicKeyUsages = ["verify", "encrypt", "wrapKey"];
            return {
              privateKey: this.wrapNativeKey(res.privateKey, args[0], args[1], args[2].filter(function (o) {
                return privateKeyUsages.includes(o);
              })),
              publicKey: this.wrapNativeKey(res.publicKey, args[0], args[1], args[2].filter(function (o) {
                return publicKeyUsages.includes(o);
              }))
            };
          } else if ("extractable" in res) {
            var algorithm;
            var usages;
            switch (method) {
              case "importKey":
                algorithm = args[2];
                usages = args[4];
                break;
              case "unwrapKey":
                algorithm = args[4];
                usages = args[6];
                break;
              case "generateKey":
                algorithm = args[0];
                usages = args[2];
                break;
              default:
                throw new OperationError("Cannot wrap native key. Unsupported method in use");
            }
            return this.wrapNativeKey(res, algorithm, res.extractable, usages);
          }
        }
        return res;
      }
    }, {
      key: "wrapNativeKey",
      value: function wrapNativeKey(key, algorithm, extractable, keyUsages) {
        if (this.browserInfo.name === Browser.IE) {
          var algs = ["RSASSA-PKCS1-v1_5", "RSA-PSS", "RSA-OAEP", "AES-CBC", "AES-CTR", "AES-KW", "HMAC"];
          var index = algs.map(function (o) {
            return o.toLowerCase();
          }).indexOf(key.algorithm.name.toLowerCase());
          if (index !== -1) {
            var alg = this.prepareAlgorithm(algorithm);
            var newAlg = Object.assign(Object.assign({}, key.algorithm), {
              name: algs[index]
            });
            if (SubtleCrypto$1.isHashedAlgorithm(alg)) {
              newAlg.hash = {
                name: alg.hash.name.toUpperCase()
              };
            }
            Debug.info("Wrapping ".concat(algs[index], " crypto key to WrappedNativeCryptoKey"));
            return new WrappedNativeCryptoKey(newAlg, extractable, key.type, keyUsages, key);
          }
        }
        return key;
      }
    }, {
      key: "castKey",
      value: function castKey(key) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee156() {
          var provider, jwk;
          return _regeneratorRuntime().wrap(function _callee156$(_context156) {
            while (1) switch (_context156.prev = _context156.next) {
              case 0:
                Debug.info("Cast native CryptoKey to linter key.", key);
                if (key.extractable) {
                  _context156.next = 3;
                  break;
                }
                throw new Error("Cannot cast unextractable crypto key");
              case 3:
                provider = this.getProvider(key.algorithm.name);
                _context156.next = 6;
                return this.exportKey("jwk", key);
              case 6:
                jwk = _context156.sent;
                return _context156.abrupt("return", provider.importKey("jwk", jwk, key.algorithm, true, key.usages));
              case 8:
              case "end":
                return _context156.stop();
            }
          }, _callee156, this);
        }));
      }
    }, {
      key: "fixAlgorithmName",
      value: function fixAlgorithmName(args) {
        if (this.browserInfo.name === Browser.Edge) {
          for (var i = 0; i < args.length; i++) {
            var arg = args[0];
            if (typeof arg === "string") {
              var _iterator20 = _createForOfIteratorHelper(this.providers.algorithms),
                _step20;
              try {
                for (_iterator20.s(); !(_step20 = _iterator20.n()).done;) {
                  var algorithm = _step20.value;
                  if (algorithm.toLowerCase() === arg.toLowerCase()) {
                    args[i] = algorithm;
                    break;
                  }
                }
              } catch (err) {
                _iterator20.e(err);
              } finally {
                _iterator20.f();
              }
            } else if (_typeof(arg) === "object" && typeof arg.name === "string") {
              var _iterator21 = _createForOfIteratorHelper(this.providers.algorithms),
                _step21;
              try {
                for (_iterator21.s(); !(_step21 = _iterator21.n()).done;) {
                  var _algorithm2 = _step21.value;
                  if (_algorithm2.toLowerCase() === arg.name.toLowerCase()) {
                    arg.name = _algorithm2;
                  }
                  if (typeof arg.hash === "string" && _algorithm2.toLowerCase() === arg.hash.toLowerCase() || _typeof(arg.hash) === "object" && typeof arg.hash.name === "string" && _algorithm2.toLowerCase() === arg.hash.name.toLowerCase()) {
                    arg.hash = {
                      name: _algorithm2
                    };
                  }
                }
              } catch (err) {
                _iterator21.e(err);
              } finally {
                _iterator21.f();
              }
            }
          }
        }
      }
    }, {
      key: "fixFirefoxEcImportPkcs8",
      value: function fixFirefoxEcImportPkcs8(args) {
        var preparedAlgorithm = this.prepareAlgorithm(args[2]);
        var algName = preparedAlgorithm.name.toUpperCase();
        if (this.browserInfo.name === Browser.Firefox && args[0] === "pkcs8" && ~["ECDSA", "ECDH"].indexOf(algName) && ~["P-256", "P-384", "P-521"].indexOf(preparedAlgorithm.namedCurve)) {
          if (!BufferSourceConverter.isBufferSource(args[1])) {
            throw new TypeError("data: Is not ArrayBuffer or ArrayBufferView");
          }
          var preparedData = BufferSourceConverter.toArrayBuffer(args[1]);
          var keyInfo = AsnConvert.parse(preparedData, index$1.PrivateKeyInfo);
          var privateKey = AsnConvert.parse(keyInfo.privateKey, index$1.EcPrivateKey);
          var jwk = JsonSerializer.toJSON(privateKey);
          jwk.ext = true;
          jwk.key_ops = args[4];
          jwk.crv = preparedAlgorithm.namedCurve;
          jwk.kty = "EC";
          args[0] = "jwk";
          args[1] = jwk;
        }
      }
    }, {
      key: "fixFirefoxEcExportPkcs8",
      value: function fixFirefoxEcExportPkcs8(args) {
        return __awaiter(this, void 0, void 0, _regeneratorRuntime().mark(function _callee157() {
          var jwk, ecKey, keyInfo;
          return _regeneratorRuntime().wrap(function _callee157$(_context157) {
            while (1) switch (_context157.prev = _context157.next) {
              case 0:
                _context157.prev = 0;
                if (!(this.browserInfo.name === Browser.Firefox && args[0] === "pkcs8" && ~["ECDSA", "ECDH"].indexOf(args[1].algorithm.name) && ~["P-256", "P-384", "P-521"].indexOf(args[1].algorithm.namedCurve))) {
                  _context157.next = 11;
                  break;
                }
                _context157.next = 4;
                return this.exportKey("jwk", args[1]);
              case 4:
                jwk = _context157.sent;
                ecKey = JsonParser.fromJSON(jwk, {
                  targetSchema: index$1.EcPrivateKey
                });
                keyInfo = new index$1.PrivateKeyInfo();
                keyInfo.privateKeyAlgorithm.algorithm = EcCrypto.ASN_ALGORITHM;
                keyInfo.privateKeyAlgorithm.parameters = AsnConvert.serialize(new index$1.ObjectIdentifier(getOidByNamedCurve$1(args[1].algorithm.namedCurve)));
                keyInfo.privateKey = AsnConvert.serialize(ecKey);
                return _context157.abrupt("return", AsnConvert.serialize(keyInfo));
              case 11:
                _context157.next = 17;
                break;
              case 13:
                _context157.prev = 13;
                _context157.t0 = _context157["catch"](0);
                Debug.error(_context157.t0);
                return _context157.abrupt("return", null);
              case 17:
              case "end":
                return _context157.stop();
            }
          }, _callee157, this, [[0, 13]]);
        }));
      }
    }], [{
      key: "isAnotherKey",
      value: function isAnotherKey(key) {
        if (_typeof(key) === "object" && typeof key.type === "string" && typeof key.extractable === "boolean" && _typeof(key.algorithm) === "object") {
          return !(key instanceof CryptoKey);
        }
        return false;
      }
    }]);
    return SubtleCrypto;
  }(SubtleCrypto$1);
  SubtleCrypto.methods = ["digest", "importKey", "exportKey", "sign", "verify", "generateKey", "encrypt", "decrypt", "deriveBits", "deriveKey", "wrapKey", "unwrapKey"];
  var Crypto = function (_Crypto$) {
    _inherits(Crypto, _Crypto$);
    function Crypto() {
      var _this109;
      _classCallCheck(this, Crypto);
      _this109 = _callSuper(this, Crypto, arguments);
      _this109.subtle = new SubtleCrypto();
      return _this109;
    }
    _createClass(Crypto, [{
      key: "nativeCrypto",
      get: function get() {
        return exports.nativeCrypto;
      }
    }, {
      key: "getRandomValues",
      value: function getRandomValues(array) {
        return exports.nativeCrypto.getRandomValues(array);
      }
    }]);
    return Crypto;
  }(Crypto$1);
  function WrapFunction(subtle, name) {
    var fn = subtle[name];
    subtle[name] = function () {
      var args = arguments;
      return new Promise(function (resolve, reject) {
        var op = fn.apply(subtle, args);
        op.oncomplete = function (e) {
          resolve(e.target.result);
        };
        op.onerror = function (_e) {
          reject("Error on running '".concat(name, "' function"));
        };
      });
    };
  }
  if (typeof self !== "undefined" && self["msCrypto"]) {
    WrapFunction(exports.nativeSubtle, "generateKey");
    WrapFunction(exports.nativeSubtle, "digest");
    WrapFunction(exports.nativeSubtle, "sign");
    WrapFunction(exports.nativeSubtle, "verify");
    WrapFunction(exports.nativeSubtle, "encrypt");
    WrapFunction(exports.nativeSubtle, "decrypt");
    WrapFunction(exports.nativeSubtle, "importKey");
    WrapFunction(exports.nativeSubtle, "exportKey");
    WrapFunction(exports.nativeSubtle, "wrapKey");
    WrapFunction(exports.nativeSubtle, "unwrapKey");
    WrapFunction(exports.nativeSubtle, "deriveKey");
    WrapFunction(exports.nativeSubtle, "deriveBits");
  }
  if (!Math.imul) {
    Math.imul = function imul(a, b) {
      var ah = a >>> 16 & 0xffff;
      var al = a & 0xffff;
      var bh = b >>> 16 & 0xffff;
      var bl = b & 0xffff;
      return al * bl + (ah * bl + al * bh << 16 >>> 0) | 0;
    };
  }
  var window$1 = self;
  if (exports.nativeCrypto) {
    Object.freeze(exports.nativeCrypto.getRandomValues);
  }
  try {
    delete self.crypto;
    window$1.crypto = new Crypto();
    Object.freeze(window$1.crypto);
  } catch (e) {
    Debug.error(e);
  }
  var crypto = window$1.crypto;
  exports.Crypto = Crypto;
  exports.CryptoKey = CryptoKey;
  exports.crypto = crypto;
  exports.setCrypto = setCrypto;
  console.log(crypto.subtle)
  console.log('asdfdf')
  return exports;
}({}, self.asmCrypto, self.elliptic);
