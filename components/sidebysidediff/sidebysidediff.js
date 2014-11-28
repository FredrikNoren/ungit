
var ko = require('knockout');
var components = require('ungit-components');
var Diff2Html = require('../../node_modules/diff2html/src/diff2html.js');

components.register('sidebysidediff', function(args) {
  return new SideBySideDiffViewModel(args);
});

var SideBySideDiffViewModel = function(args) {
  this.filename = args.filename;
  this.repoPath = args.repoPath;
  this.server = args.server;
  this.diffs = ko.observable();
  this.sha1 = args.sha1;
  this.totalNumberOfLines = ko.observable(0);
}

SideBySideDiffViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('sidebysidediff', this, {}, parentElement);

  var diffJson = Diff2Html.getJsonFromDiff(lineDiffExample);
  var sidebyside = Diff2Html.getPrettySideBySideHtmlFromJson(diffJson);
  document.getElementById('side-by-side').innerHTML = sidebyside;
}

SideBySideDiffViewModel.prototype.getDiffArguments = function() {
  var args = {};

  args.file = this.filename;
  args.path = this.repoPath;
  args.sha1 = this.sha1 ? this.sha1 : '';
  args.isGetRaw = true;

  return args;
}

SideBySideDiffViewModel.prototype.invalidateDiff = function(callback) {
  var self = this;

  self.server.get('/diff', this.getDiffArguments() , function(err, diffs) {
    console.log(diffs);

    if (callback) callback();
  });
}



var lineDiffExample = 'diff --git a/src/attributes/attr.js b/src/attributes/attr.js\n' +
'index facdd41..b627fe8 100644\n' +
'--- a/src/attributes/attr.js\n' +
'+++ b/src/attributes/attr.js\n' +
'@@ -1,11 +1,10 @@\n' +
' define([\n' +
' 	"../core",\n' +
' 	"../var/rnotwhite",\n' +
'-	"../var/strundefined",\n' +
' 	"../core/access",\n' +
' 	"./support",\n' +
' 	"../selector"\n' +
'-], function( jQuery, rnotwhite, strundefined, access, support ) {\n' +
'+], function( jQuery, rnotwhite, access, support ) {\n' +
' \n' +
' var nodeHook, boolHook,\n' +
' 	attrHandle = jQuery.expr.attrHandle;\n' +
'@@ -33,7 +32,7 @@ jQuery.extend({\n' +
' 		}\n' +
' \n' +
' 		// Fallback to prop when attributes are not supported\n' +
'-		if ( typeof elem.getAttribute === strundefined ) {\n' +
'+		if ( !elem.getAttribute ) {\n' +
' 			return jQuery.prop( elem, name, value );\n' +
' 		}\n' +
' \n' +
'diff --git a/src/attributes/classes.js b/src/attributes/classes.js\n' +
'index c617824..c8d1393 100644\n' +
'--- a/src/attributes/classes.js\n' +
'+++ b/src/attributes/classes.js\n' +
'@@ -1,10 +1,9 @@\n' +
' define([\n' +
' 	"../core",\n' +
' 	"../var/rnotwhite",\n' +
'-	"../var/strundefined",\n' +
' 	"../data/var/dataPriv",\n' +
' 	"../core/init"\n' +
'-], function( jQuery, rnotwhite, strundefined, dataPriv ) {\n' +
'+], function( jQuery, rnotwhite, dataPriv ) {\n' +
' \n' +
' var rclass = /[\t\r\n\f]/g;\n' +
' \n' +
'@@ -128,7 +127,7 @@ jQuery.fn.extend({\n' +
' 				}\n' +
' \n' +
' 			// Toggle whole class name\n' +
'-			} else if ( type === strundefined || type === "boolean" ) {\n' +
'+			} else if ( value === undefined || type === "boolean" ) {\n' +
' 				if ( this.className ) {\n' +
' 					// store className if set\n' +
' 					dataPriv.set( this, "__className__", this.className );\n' +
'diff --git a/src/core/init.js b/src/core/init.js\n' +
'index e49196a..50f310c 100644\n' +
'--- a/src/core/init.js\n' +
'+++ b/src/core/init.js\n' +
'@@ -101,7 +101,7 @@ var rootjQuery,\n' +
' 		// HANDLE: $(function)\n' +
' 		// Shortcut for document ready\n' +
' 		} else if ( jQuery.isFunction( selector ) ) {\n' +
'-			return typeof rootjQuery.ready !== "undefined" ?\n' +
'+			return rootjQuery.ready !== undefined ?\n' +
' 				rootjQuery.ready( selector ) :\n' +
' 				// Execute immediately if ready is not present\n' +
' 				selector( jQuery );\n' +
'diff --git a/src/event.js b/src/event.js\n' +
'index 7336f4d..6183f70 100644\n' +
'--- a/src/event.js\n' +
'+++ b/src/event.js\n' +
'@@ -1,6 +1,5 @@\n' +
' define([\n' +
' 	"./core",\n' +
'-	"./var/strundefined",\n' +
' 	"./var/rnotwhite",\n' +
' 	"./var/hasOwn",\n' +
' 	"./var/slice",\n' +
'@@ -10,7 +9,7 @@ define([\n' +
' 	"./core/init",\n' +
' 	"./data/accepts",\n' +
' 	"./selector"\n' +
'-], function( jQuery, strundefined, rnotwhite, hasOwn, slice, support, dataPriv ) {\n' +
'+], function( jQuery, rnotwhite, hasOwn, slice, support, dataPriv ) {\n' +
' \n' +
' var\n' +
' 	rkeyEvent = /^key/,\n' +
'@@ -72,7 +71,7 @@ jQuery.event = {\n' +
' 			eventHandle = elemData.handle = function( e ) {\n' +
' 				// Discard the second event of a jQuery.event.trigger() and\n' +
' 				// when an event is called after a page has unloaded\n' +
'-				return typeof jQuery !== strundefined && jQuery.event.triggered !== e.type ?\n' +
'+				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?\n' +
' 					jQuery.event.dispatch.apply( elem, arguments ) : undefined;\n' +
' 			};\n' +
' 		}\n' +
'diff --git a/src/exports/global.js b/src/exports/global.js\n' +
'index 6513287..1db4144 100644\n' +
'--- a/src/exports/global.js\n' +
'+++ b/src/exports/global.js\n' +
'@@ -1,7 +1,9 @@\n' +
' define([\n' +
'-	"../core",\n' +
'-	"../var/strundefined"\n' +
'-], function( jQuery, strundefined ) {\n' +
'+	"../core"\n' +
'+], function( jQuery ) {\n' +
'+\n' +
'+/* exported noGlobal */\n' +
'+/* global   noGlobal: false */\n' +
' \n' +
' var\n' +
' 	// Map over jQuery in case of overwrite\n' +
'@@ -25,7 +27,7 @@ jQuery.noConflict = function( deep ) {\n' +
' // Expose jQuery and $ identifiers, even in AMD\n' +
' // (#7102#comment:10, https://github.com/jquery/jquery/pull/557)\n' +
' // and CommonJS for browser emulators (#13566)\n' +
'-if ( typeof noGlobal === strundefined ) {\n' +
'+if ( !noGlobal ) {\n' +
' 	window.jQuery = window.$ = jQuery;\n' +
' }\n' +
' \n' +
'diff --git a/src/offset.js b/src/offset.js\n' +
'index cc6ffb4..fa51f18 100644\n' +
'--- a/src/offset.js\n' +
'+++ b/src/offset.js\n' +
'@@ -1,6 +1,5 @@\n' +
' define([\n' +
' 	"./core",\n' +
'-	"./var/strundefined",\n' +
' 	"./core/access",\n' +
' 	"./css/var/rnumnonpx",\n' +
' 	"./css/curCSS",\n' +
'@@ -10,7 +9,7 @@ define([\n' +
' 	"./core/init",\n' +
' 	"./css",\n' +
' 	"./selector" // contains\n' +
'-], function( jQuery, strundefined, access, rnumnonpx, curCSS, addGetHookIf, support ) {\n' +
'+], function( jQuery, access, rnumnonpx, curCSS, addGetHookIf, support ) {\n' +
' \n' +
' var docElem = window.document.documentElement;\n' +
' \n' +
'@@ -99,7 +98,7 @@ jQuery.fn.extend({\n' +
' \n' +
' 		// Support: BlackBerry 5, iOS 3 (original iPhone)\n' +
' 		// If we dont have gBCR, just use 0,0 rather than error\n' +
'-		if ( typeof elem.getBoundingClientRect !== strundefined ) {\n' +
'+		if ( elem.getBoundingClientRect !== undefined ) {\n' +
' 			box = elem.getBoundingClientRect();\n' +
' 		}\n' +
' 		win = getWindow( doc );\n' +
'diff --git a/src/var/strundefined.js b/src/var/strundefined.js\n' +
'deleted file mode 100644\n' +
'index 04e16b0..0000000\n' +
'--- a/src/var/strundefined.js\n' +
'+++ /dev/null\n' +
'@@ -1,3 +0,0 @@\n' +
'-define(function() {\n' +
'-	return typeof undefined;\n' +
'-});\n';
