!function(global,module){function expect(e){return new Assertion(e)}function Assertion(e,t,n){if(this.obj=e,this.flags={},void 0!=n){this.flags[t]=!0;for(var i in n.flags)n.flags.hasOwnProperty(i)&&(this.flags[i]=!0)}var o=t?flags[t]:keys(flags),r=this;if(o)for(var i=0,s=o.length;s>i;i++)if(!this.flags[o[i]]){var a=o[i],u=new Assertion(this.obj,a,this);if("function"==typeof Assertion.prototype[a]){var c=this[a];this[a]=function(){return c.apply(r,arguments)};for(var p in Assertion.prototype)Assertion.prototype.hasOwnProperty(p)&&p!=a&&(this[a][p]=bind(u[p],u))}else this[a]=u}}function bind(e,t){return function(){return e.apply(t,arguments)}}function every(e,t,n){for(var i=n||global,o=0,r=e.length;r>o;++o)if(!t.call(i,e[o],o,e))return!1;return!0}function indexOf(e,t,n){if(Array.prototype.indexOf)return Array.prototype.indexOf.call(e,t,n);if(void 0===e.length)return-1;for(var i=e.length,n=0>n?0>n+i?0:n+i:n||0;i>n&&e[n]!==t;n++);return n>=i?-1:n}function i(e,t,n){function i(e){return e}function o(e,n){if(e&&"function"==typeof e.inspect&&e!==exports&&(!e.constructor||e.constructor.prototype!==e))return e.inspect(n);switch(typeof e){case"undefined":return i("undefined","undefined");case"string":var s="'"+json.stringify(e).replace(/^"|"$/g,"").replace(/'/g,"\\'").replace(/\\"/g,'"')+"'";return i(s,"string");case"number":return i(""+e,"number");case"boolean":return i(""+e,"boolean")}if(null===e)return i("null","null");if(isDOMElement(e))return getOuterHTML(e);var a=keys(e),u=t?Object.getOwnPropertyNames(e):a;if("function"==typeof e&&0===u.length){if(isRegExp(e))return i(""+e,"regexp");var c=e.name?": "+e.name:"";return i("[Function"+c+"]","special")}if(isDate(e)&&0===u.length)return i(e.toUTCString(),"date");var p,l,d;if(isArray(e)?(l="Array",d=["[","]"]):(l="Object",d=["{","}"]),"function"==typeof e){var h=e.name?": "+e.name:"";p=isRegExp(e)?" "+e:" [Function"+h+"]"}else p="";if(isDate(e)&&(p=" "+e.toUTCString()),0===u.length)return d[0]+p+d[1];if(0>n)return isRegExp(e)?i(""+e,"regexp"):i("[Object]","special");r.push(e);var f=map(u,function(t){var s,u;if(e.__lookupGetter__&&(e.__lookupGetter__(t)?u=e.__lookupSetter__(t)?i("[Getter/Setter]","special"):i("[Getter]","special"):e.__lookupSetter__(t)&&(u=i("[Setter]","special"))),indexOf(a,t)<0&&(s="["+t+"]"),u||(indexOf(r,e[t])<0?(u=null===n?o(e[t]):o(e[t],n-1),u.indexOf("\n")>-1&&(u=isArray(e)?map(u.split("\n"),function(e){return"  "+e}).join("\n").substr(2):"\n"+map(u.split("\n"),function(e){return"   "+e}).join("\n"))):u=i("[Circular]","special")),"undefined"==typeof s){if("Array"===l&&t.match(/^\d+$/))return u;s=json.stringify(""+t),s.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?(s=s.substr(1,s.length-2),s=i(s,"name")):(s=s.replace(/'/g,"\\'").replace(/\\"/g,'"').replace(/(^"|"$)/g,"'"),s=i(s,"string"))}return s+": "+u});r.pop();var g=0,y=reduce(f,function(e,t){return g++,indexOf(t,"\n")>=0&&g++,e+t.length+1},0);return f=y>50?d[0]+(""===p?"":p+"\n ")+" "+f.join(",\n  ")+" "+d[1]:d[0]+p+" "+f.join(", ")+" "+d[1]}var r=[];return o(e,"undefined"==typeof n?2:n)}function isArray(e){return"[object Array]"==Object.prototype.toString.call(e)}function isRegExp(e){var t;try{t=""+e}catch(n){return!1}return e instanceof RegExp||"function"==typeof e&&"RegExp"===e.constructor.name&&e.compile&&e.test&&e.exec&&t.match(/^\/.*\/[gim]{0,3}$/)}function isDate(e){return e instanceof Date?!0:!1}function keys(e){if(Object.keys)return Object.keys(e);var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&t.push(n);return t}function map(e,t,n){if(Array.prototype.map)return Array.prototype.map.call(e,t,n);for(var i=new Array(e.length),o=0,r=e.length;r>o;o++)o in e&&(i[o]=t.call(n,e[o],o,e));return i}function reduce(e,t){if(Array.prototype.reduce)return Array.prototype.reduce.apply(e,Array.prototype.slice.call(arguments,1));var n=+this.length;if("function"!=typeof t)throw new TypeError;if(0===n&&1===arguments.length)throw new TypeError;var i=0;if(arguments.length>=2)var o=arguments[1];else for(;;){if(i in this){o=this[i++];break}if(++i>=n)throw new TypeError}for(;n>i;i++)i in this&&(o=t.call(null,o,this[i],i,this));return o}function isUndefinedOrNull(e){return null===e||void 0===e}function isArguments(e){return"[object Arguments]"==Object.prototype.toString.call(e)}function objEquiv(e,t){if(isUndefinedOrNull(e)||isUndefinedOrNull(t))return!1;if(e.prototype!==t.prototype)return!1;if(isArguments(e))return isArguments(t)?(e=pSlice.call(e),t=pSlice.call(t),expect.eql(e,t)):!1;try{var n,i,o=keys(e),r=keys(t)}catch(s){return!1}if(o.length!=r.length)return!1;for(o.sort(),r.sort(),i=o.length-1;i>=0;i--)if(o[i]!=r[i])return!1;for(i=o.length-1;i>=0;i--)if(n=o[i],!expect.eql(e[n],t[n]))return!1;return!0}if("undefined"==typeof module)var module={exports:{}},exports=module.exports;module.exports=expect,expect.Assertion=Assertion,expect.version="0.1.2";var flags={not:["to","be","have","include","only"],to:["be","have","include","only","not"],only:["have"],have:["own"],be:["an"]};Assertion.prototype.assert=function(e,t,n){var t=this.flags.not?n:t,i=this.flags.not?!e:e;if(!i)throw new Error(t.call(this));this.and=new Assertion(this.obj)},Assertion.prototype.ok=function(){this.assert(!!this.obj,function(){return"expected "+i(this.obj)+" to be truthy"},function(){return"expected "+i(this.obj)+" to be falsy"})},Assertion.prototype.throwError=Assertion.prototype.throwException=function(e){expect(this.obj).to.be.a("function");var t=!1,n=this.flags.not;try{this.obj()}catch(i){if("function"==typeof e)e(i);else if("object"==typeof e){var o="string"==typeof i?i:i.message;n?expect(o).to.not.match(e):expect(o).to.match(e)}t=!0}"object"==typeof e&&n&&(this.flags.not=!1);var r=this.obj.name||"fn";this.assert(t,function(){return"expected "+r+" to throw an exception"},function(){return"expected "+r+" not to throw an exception"})},Assertion.prototype.empty=function(){var e;return"object"!=typeof this.obj||null===this.obj||isArray(this.obj)?("string"!=typeof this.obj&&expect(this.obj).to.be.an("object"),expect(this.obj).to.have.property("length"),e=!this.obj.length):e="number"==typeof this.obj.length?!this.obj.length:!keys(this.obj).length,this.assert(e,function(){return"expected "+i(this.obj)+" to be empty"},function(){return"expected "+i(this.obj)+" to not be empty"}),this},Assertion.prototype.be=Assertion.prototype.equal=function(e){return this.assert(e===this.obj,function(){return"expected "+i(this.obj)+" to equal "+i(e)},function(){return"expected "+i(this.obj)+" to not equal "+i(e)}),this},Assertion.prototype.eql=function(e){return this.assert(expect.eql(e,this.obj),function(){return"expected "+i(this.obj)+" to sort of equal "+i(e)},function(){return"expected "+i(this.obj)+" to sort of not equal "+i(e)}),this},Assertion.prototype.within=function(e,t){var n=e+".."+t;return this.assert(this.obj>=e&&this.obj<=t,function(){return"expected "+i(this.obj)+" to be within "+n},function(){return"expected "+i(this.obj)+" to not be within "+n}),this},Assertion.prototype.a=Assertion.prototype.an=function(e){if("string"==typeof e){var t=/^[aeiou]/.test(e)?"n":"";this.assert("array"==e?isArray(this.obj):"object"==e?"object"==typeof this.obj&&null!==this.obj:e==typeof this.obj,function(){return"expected "+i(this.obj)+" to be a"+t+" "+e},function(){return"expected "+i(this.obj)+" not to be a"+t+" "+e})}else{var n=e.name||"supplied constructor";this.assert(this.obj instanceof e,function(){return"expected "+i(this.obj)+" to be an instance of "+n},function(){return"expected "+i(this.obj)+" not to be an instance of "+n})}return this},Assertion.prototype.greaterThan=Assertion.prototype.above=function(e){return this.assert(this.obj>e,function(){return"expected "+i(this.obj)+" to be above "+e},function(){return"expected "+i(this.obj)+" to be below "+e}),this},Assertion.prototype.lessThan=Assertion.prototype.below=function(e){return this.assert(this.obj<e,function(){return"expected "+i(this.obj)+" to be below "+e},function(){return"expected "+i(this.obj)+" to be above "+e}),this},Assertion.prototype.match=function(e){return this.assert(e.exec(this.obj),function(){return"expected "+i(this.obj)+" to match "+e},function(){return"expected "+i(this.obj)+" not to match "+e}),this},Assertion.prototype.length=function(e){expect(this.obj).to.have.property("length");var t=this.obj.length;return this.assert(e==t,function(){return"expected "+i(this.obj)+" to have a length of "+e+" but got "+t},function(){return"expected "+i(this.obj)+" to not have a length of "+t}),this},Assertion.prototype.property=function(e,t){if(this.flags.own)return this.assert(Object.prototype.hasOwnProperty.call(this.obj,e),function(){return"expected "+i(this.obj)+" to have own property "+i(e)},function(){return"expected "+i(this.obj)+" to not have own property "+i(e)}),this;if(this.flags.not&&void 0!==t){if(void 0===this.obj[e])throw new Error(i(this.obj)+" has no property "+i(e))}else{var n;try{n=e in this.obj}catch(o){n=void 0!==this.obj[e]}this.assert(n,function(){return"expected "+i(this.obj)+" to have a property "+i(e)},function(){return"expected "+i(this.obj)+" to not have a property "+i(e)})}return void 0!==t&&this.assert(t===this.obj[e],function(){return"expected "+i(this.obj)+" to have a property "+i(e)+" of "+i(t)+", but got "+i(this.obj[e])},function(){return"expected "+i(this.obj)+" to not have a property "+i(e)+" of "+i(t)}),this.obj=this.obj[e],this},Assertion.prototype.string=Assertion.prototype.contain=function(e){return"string"==typeof this.obj?this.assert(~this.obj.indexOf(e),function(){return"expected "+i(this.obj)+" to contain "+i(e)},function(){return"expected "+i(this.obj)+" to not contain "+i(e)}):this.assert(~indexOf(this.obj,e),function(){return"expected "+i(this.obj)+" to contain "+i(e)},function(){return"expected "+i(this.obj)+" to not contain "+i(e)}),this},Assertion.prototype.key=Assertion.prototype.keys=function(e){var t,n=!0;if(e=isArray(e)?e:Array.prototype.slice.call(arguments),!e.length)throw new Error("keys required");var o=keys(this.obj),r=e.length;if(n=every(e,function(e){return~indexOf(o,e)}),!this.flags.not&&this.flags.only&&(n=n&&e.length==o.length),r>1){e=map(e,function(e){return i(e)});var s=e.pop();t=e.join(", ")+", and "+s}else t=i(e[0]);return t=(r>1?"keys ":"key ")+t,t=(this.flags.only?"only have ":"include ")+t,this.assert(n,function(){return"expected "+i(this.obj)+" to "+t},function(){return"expected "+i(this.obj)+" to not "+t}),this},Assertion.prototype.fail=function(e){return e=e||"explicit failure",this.assert(!1,e,e),this};var getOuterHTML=function(e){if("outerHTML"in e)return e.outerHTML;var t="http://www.w3.org/1999/xhtml",n=document.createElementNS(t,"_");(window.HTMLElement||window.Element).prototype;var i,o=new XMLSerializer;return document.xmlVersion?o.serializeToString(e):(n.appendChild(e.cloneNode(!1)),i=n.innerHTML.replace("><",">"+e.innerHTML+"<"),n.innerHTML="",i)},isDOMElement=function(e){return"object"==typeof HTMLElement?e instanceof HTMLElement:e&&"object"==typeof e&&1===e.nodeType&&"string"==typeof e.nodeName};expect.eql=function(e,t){if(e===t)return!0;if("undefined"!=typeof Buffer&&Buffer.isBuffer(e)&&Buffer.isBuffer(t)){if(e.length!=t.length)return!1;for(var n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}return e instanceof Date&&t instanceof Date?e.getTime()===t.getTime():"object"!=typeof e&&"object"!=typeof t?e==t:objEquiv(e,t)};var json=function(){"use strict";function f(e){return 10>e?"0"+e:e}function date(e){return isFinite(e.valueOf())?e.getUTCFullYear()+"-"+f(e.getUTCMonth()+1)+"-"+f(e.getUTCDate())+"T"+f(e.getUTCHours())+":"+f(e.getUTCMinutes())+":"+f(e.getUTCSeconds())+"Z":null}function quote(e){return escapable.lastIndex=0,escapable.test(e)?'"'+e.replace(escapable,function(e){var t=meta[e];return"string"==typeof t?t:"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+e+'"'}function str(e,t){var n,i,o,r,s,a=gap,u=t[e];switch(u instanceof Date&&(u=date(e)),"function"==typeof rep&&(u=rep.call(t,e,u)),typeof u){case"string":return quote(u);case"number":return isFinite(u)?String(u):"null";case"boolean":case"null":return String(u);case"object":if(!u)return"null";if(gap+=indent,s=[],"[object Array]"===Object.prototype.toString.apply(u)){for(r=u.length,n=0;r>n;n+=1)s[n]=str(n,u)||"null";return o=0===s.length?"[]":gap?"[\n"+gap+s.join(",\n"+gap)+"\n"+a+"]":"["+s.join(",")+"]",gap=a,o}if(rep&&"object"==typeof rep)for(r=rep.length,n=0;r>n;n+=1)"string"==typeof rep[n]&&(i=rep[n],o=str(i,u),o&&s.push(quote(i)+(gap?": ":":")+o));else for(i in u)Object.prototype.hasOwnProperty.call(u,i)&&(o=str(i,u),o&&s.push(quote(i)+(gap?": ":":")+o));return o=0===s.length?"{}":gap?"{\n"+gap+s.join(",\n"+gap)+"\n"+a+"}":"{"+s.join(",")+"}",gap=a,o}}if("object"==typeof JSON&&JSON.parse&&JSON.stringify)return{parse:nativeJSON.parse,stringify:nativeJSON.stringify};var JSON={},cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;return JSON.stringify=function(e,t,n){var i;if(gap="",indent="","number"==typeof n)for(i=0;n>i;i+=1)indent+=" ";else"string"==typeof n&&(indent=n);if(rep=t,t&&"function"!=typeof t&&("object"!=typeof t||"number"!=typeof t.length))throw new Error("JSON.stringify");return str("",{"":e})},JSON.parse=function(text,reviver){function walk(e,t){var n,i,o=e[t];if(o&&"object"==typeof o)for(n in o)Object.prototype.hasOwnProperty.call(o,n)&&(i=walk(o,n),void 0!==i?o[n]=i:delete o[n]);return reviver.call(e,t,o)}var j;if(text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(e){return"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)})),/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return j=eval("("+text+")"),"function"==typeof reviver?walk({"":j},""):j;throw new SyntaxError("JSON.parse")},JSON}();"undefined"!=typeof window&&(window.expect=module.exports)}(this,"undefined"!=typeof module?module:{},"undefined"!=typeof exports?exports:{});