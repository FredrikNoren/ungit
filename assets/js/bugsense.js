var bugsense;

(function ( root, factory ) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define(function () {
            // Also create a global in case some scripts
            // that are loaded still are looking for
            // a global even when an AMD loader is in use.
            return ( root.Bugsense = factory() );
        });
    } else {
        // Browser globals
        root.Bugsense = factory();
    }
}( this, function () {

  /**
   * Simple extend() implementation
   * @param  {Object} original The object to extend
   * @param  {Object} extra    The properties to extend with
   * @return {Object}          The extended original object
   */
  var extend = function extend ( original, extra ) {
    return Object.keys( extra ).forEach( function ( key ) { original[ key ] = extra[ key ]; } );
  };

  // BEGIN - Extracted from Zepto
  var escape = encodeURIComponent;

  var isObject = function isObject ( instance ) {
    return instance instanceof Object;
  };

  var isArray = function isArray ( instance ) {
    return instance instanceof Array;
  };

  var isValidKeyValue = function isValidKeyValue ( instance ) {
    return ( typeof(instance) == 'string' || typeof(instance) == 'number' || typeof(instance) == 'boolean' );
  };

  /**
   * Simple forEach, implements jQuery/Zepto api, sort of, and most likely breaks with arrays: LOL
   * @param  {Object} obj      To be iterated
   * @param  {Object} iterator Iterator function
   */
  var forEach = function forEach ( obj, iterator ) {
    Array.prototype.forEach.call( Object.keys( obj ), function ( key ) {
      iterator( key, obj[ key ] );
    } );
  };

  var serialize = function serialize ( params, obj, traditional, scope ) {
    var array = isArray( obj );

    forEach( obj, function ( key, value ) {
      if ( scope ) { key = traditional ? scope : scope + '[' + (array ? '' : key) + ']'; }

      // handle data in serializeArray() format
      if ( !scope && array ) {
        params.add( value.name, value.value );
      // recurse into nested objects
      } else if ( traditional ? isArray( value ) : isObject( value ) ) {
        serialize( params, value, traditional, key );
      } else {
        params.add( key, value );
      }
    });
  };

  var param = function param ( obj, traditional ) {
    var params = [];
    params.add = function( k, v ){ this.push( escape( k ) + '=' + escape( v ) ); };
    serialize( params, obj, traditional );
    return params.join( '&' ).replace( /%20/g, '+' );
  };
    // END - Extracted from Zepto


  var guid_generator = function GUIDGenerator() {
      var S4 = function () {
          return Math.floor(
                  Math.random() * 0x10000 /* 65536 */
              ).toString(16);
      };

      return (
              S4() + S4() + "-" +
              S4() + "-" +
              S4() + "-" +
              S4() + "-" +
              S4() + S4() + S4()
          );
  }
    
  
  /**
   * Constructor for the Bugsense instance
   * @param {Object} config Overrides for the default config, use to specify api key
   */
  var Bugsense = function ( config ) {
      extend(this.config, config);
      this.config.winjs = typeof (WinJS) !== 'undefined';
      this.extraData = {};
      this.breadcrumbs = [];

    bugsense = this;
    if ( typeof(this.config.context.onerror) !== 'undefined' )
        this.config.context.onerror = bugsense.onerror;
    // WINJS
    if ( this.config.winjs ) {
        WinJS.Promise.onerror = bugsense.onpremiseerror;
        var p = Windows.ApplicationModel.Package.current.id.version;
        this.config.appversion = [p.major, p.minor, p.build, p.revision].join('.');
        this.send_cached_report_if_any();
        // Create unique device id
        var localSettings = Windows.Storage.ApplicationData.current.localSettings;
        var guid = localSettings['guid'];
        if (!guid) {
            guid = guid_generator();
            localSettings['guid'] = guid;
        }
        this.config.guid = guid;
    }
    // CORDOVA

    return this;
  };

  // Default config
  Bugsense.prototype.config = {
    apiKey     : 'FOOBAR',
    url        : 'https://www.bugsense.com/api/errors',
    //url      : 'https://csh-bugsense.fwd.wf/api/errors',
    pingUrl    : 'http://ticks2.bugsense.com/api/ticks', 
    appversion : null, 
    popup      : false, // unless WinJS
    callback   : null,
    context: window,
    winjs: null,
    message: null
  };

  /** 
    * Add extra data (meta data) to be sent upon uncaught exception
    * @params {String} key      Key
    * @params {String} value    Value
    */
  Bugsense.prototype.addExtraData = function bugsenseAddExtraData ( key, value ) {
     if ( isValidKeyValue( key ) && isValidKeyValue( value ) ) {
        this.extraData[ key ] = value;
     }
  }

  /** 
    * Remove a key value pair from extra data
    * @params {String} key      Key
    */
  Bugsense.prototype.removeExtraData = function bugsenseRemoveExtraData ( key ) {
     delete this.extraData[ key ];
  }

  /** 
    * Clear extra data
    */
  Bugsense.prototype.clearExtraData = function bugsenseClearExtraData () {
     this.extraData = {};
  }

  /** 
    * Leave a breadcrump
    * @params {String} breadcrumb  Breadcrumb
    */
  Bugsense.prototype.leaveBreadcrumb = function bugsenseLeaveBreadcrumb ( breadcrumb ) {
     if ( isValidKeyValue( breadcrumb ) ) {
        if ( this.breadcrumbs.length + 1 == 16 ) {
            this.breadcrumbs = this.breadcrumbs.slice( 1 );
        }
        this.breadcrumbs.push( breadcrumb );
     }
  }

  /** 
    * Clear breadcrumbs
    */
  Bugsense.prototype.clearBreadcrumbs = function bugsenseClearBreadcrumbs () {
     this.breadcrumbs = {};
  }

    /**
      * Kill bugsense and the app. Force exit
      */
  Bugsense.prototype._die = function bugsenseDie() {
      throw 'BugSense exited';
  }

  /**
   * Handles the response from the Bugsense API endpoint
   * @param  {Object} data       Bugsense response object
   * @param  {String} textStatus Response http status code
   * @param  {Object} XHR        XHR object
   */
  Bugsense.prototype.successHandler = function bugsenseSuccessHandler(request) {
      // Die
      function _die () { throw 'BugSense exited'; }
      // TODO if WinJS show notifications to user
      if (request.target && request.target.readyState != 4) { return; }
      if (request.target && request.target.status != 200 && bugsense.config.winjs) {
          return false;
      }

      // some console.log implementations don't support multiple parameters, guess it's okay in this case to concatenate
      if ('console' in window) {
          console.log('logged 1 error to Bugsense, status: ' + request.target.responseText);
      }
      if (bugsense.config.winjs) {
          if (request.target.responseText !== undefined && request.target.responseText.indexOf('url') > 0) {
              var response = JSON.parse(request.target.responseText);
              // Display fix notification if set
       
                  var md = new Windows.UI.Popups.MessageDialog(response.data.tickerText);
                  var result, resultOptions = ['Update', 'Cancel'];
                  var cmd;

                  for (var i = 0; i < resultOptions.length; i++) {
                      cmd = new Windows.UI.Popups.UICommand();
                      cmd.label = resultOptions[i];
                      // Style update
                      cmd.invoked = function (c) {
                          result = c.label;
                      }
                      md.commands.append(cmd);
                  }

                  md.showAsync().then(function (c) {
                      if (c.label == 'Update') {
                          var uri = Windows.Foundation.Uri(response.data.url);
                          Windows.System.Launcher.launchUriAsync(uri);
                      }
                      return c.label;
                  }).done(function complete() { window.bugsense._die(); });
              // Show popup message is set
              
          } else if (request.target.responseText.length > 0 && request.target.responseText.indexOf('url') < 0) { // NOT OPTIONS
              if (window.bugsense.config.message !== null) {
                  var md = new Windows.UI.Popups.MessageDialog(window.bugsense.config.message);
                  var result, resultOptions = ['OK'];
                  var cmd;

                  for (var i = 0; i < resultOptions.length; i++) {
                      cmd = new Windows.UI.Popups.UICommand();
                      cmd.label = resultOptions[i];
                      cmd.invoked = function (c) {
                          result = c.label;
                      }
                      md.commands.append(cmd);
                  }

                  md.showAsync().then(function (c) {
                      return c.label;
                  }).done(function complete() { window.bugsense._die(); });
              } else {
                  // Just die!
                  window.bugsense._die();
              }
          } 
      }
    
  };

  /**
   * Returns the Bugsense api url, with a cacheBuster argument
   * @return {String} Bugsense API URL endpoint
   */
  Bugsense.prototype.getPostURL = function bugsenseGetPostURL () {
    return Bugsense.prototype.config.url + '?cacheBuster=' + ( new Date() ).getTime();
  };

  /**
   * Parses a raw Error object
   * @param  {Object} error A raw Error object - e.g.: as sent from try/catch
   * @return {Object}       An object containing the parsed data as its properties
   */
  Bugsense.prototype.parseError = function bugsenseParseError ( error ) {
    var parsedError = {}
    // Firefox
    if ( navigator.userAgent.toLowerCase().indexOf('firefox') > -1 ){
        parsedError = {
            message: error.message,
            url: window.location.href,
            line: error.lineNumber,
            stack: error.stack,
            type: error.name
        }
    // Unhandled WinJS
    } else if ( this.config.winjs === true && typeof( error.stack ) === 'undefined' ) {
        parsedError = {
            message: error.detail.errorMessage,
            url: error.detail.errorUrl,
            line: error.detail.errorLine,
            stack: ( error.detail.stack === undefined ) ? error.detail.errorMessage : error.detail.stack,
            type: error.detail.errorCode
        };
    // Handled WinJS
    } else if (this.config.winjs === true && typeof( error.stack ) !== 'undefined') {
        var s = error.stack;
        var tmp = s.substr(s.indexOf('(') + 1, s.indexOf(')') - s.indexOf('(') - 1).split(':');
        parsedError = {
            message: error.message,
            url: tmp[0] + ':' + tmp[1],
            line:tmp[2] ,
            stack: error.stack,
            type: error.stack.split(':')[0],
            handled: true
        };
    // Webkit
    } else {
        var where_parts = error.stack.split( '\n' ).slice(1)[0].match( /\s+at\s.*(\/.*\..*|<anonymous>:\d*:\d*)/ );
        // If .stack is not available
        try {
            var tmp = error.stack;
        } catch ( error ) {
            error.stack = error.message;
        }

        parsedError = {
          message: [ error.name, error.message ].join( ': ' ),
          url: where_parts[ 1 ].split( ':' )[ 0 ].replace("/",""),
          line: where_parts[ 1 ].split( ':' )[ 1 ],
          stack: error.stack,
          type: error.name
        };
    }

    if ( parsedError.stack == null || ( typeof( parsedError.stack ) == 'string' && parsedError.stack.length == 0 ) ) {
        parsedError.stack = parsedError.message;
    }

    return parsedError;
  };

  /**
   * Generates an object containing the exception data, compliant with Bugsense's API
   * @param  {String} exception   The error message ( also accepts Error Object, will be normalized )
   *                              e.g.: "Uncaught ReferenceError: ben is not defined"
   * @param  {String} url         The originating url
   *                              e.g.: "http://lmjabreu.local:8002/assets/js/main.js"
   * @param  {Number} line        The line number
   *                              e.g.: "12"
   * @param  {Object} custom_Data An object containing extra debugging data
   * @return {Object}           Bugsense API-compliant exception object
   */
  Bugsense.prototype.generateExceptionData = function bugsenseGenerateExceptionData ( message, url, line, stack, custom_data ) {
    if ( typeof( message ) != "string" ) {
        message = message.toString()
    }

    var s = window.navigator.userAgent;
    var connection_type = 'unknown';
    if (this.config.winjs) {
        try {
            connection_type = Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile().profileName;
        } catch (exception) {
            connection_type = 'Offline';
        }
    } else if ( typeof window.navigator.network !== 'undefined' ) {
        connection_type = window.navigator.network.connection.type;
    }

    var data = {
      // information about the bugsense client
      client: {
        // Obligatory
        'name'    : 'bugsense-js',
        // Optional
        'version' : '1.1'
      },
      // Optional
      // details & custom data about the exception including url, request, response,…
      request: {
        'custom_data' : custom_data
      },
      // basics about the exception
      exception: {
        // Obligatory
        'message'     : message,
        'where'       : [ url, line ].join( ':' ),
        'klass'       : message.split( ':' )[ 0 ],
        'backtrace'   : ( typeof(stack) === 'undefined' ) ? message : stack,
        'breadcrumbs': this.breadcrumbs
      },
      // basic data ( required )
      application_environment: {
        // Obligatory
        'phone'              : window.navigator.platform,
        'appver'             : ( this.config.appversion || 'unknown' ),
        'appname'            : ( this.config.appname || 'unknown' ),
        'osver'              : ( typeof window.device !== 'undefined' ) ? window.device.version : s.substr(s.indexOf('; ')+2,s.length).replace(')',';').split(';')[0] || 'unknown' ,
        // Optional
        'connection_type'    : connection_type,
        'user_agent'         : window.navigator.userAgent,
        'cordova'            : ( typeof window.device !== 'undefined' ) ? window.device.cordova : 'unknown',
        'device_name'        : ( typeof window.device !== 'undefined' ) ? window.device.name : 'unknown',
        'log_data'           : this.extraData
      }
    };

    if (this.config.winjs) {
        // Extra vars for Windows apps
        data.application_environment.cpuClass = window.navigator.cpuClass;
        data.application_environment.osver = window.navigator.userAgent.split(';')[2];
        data.application_environment.languages = window.navigator.systemLanguage;
        data.application_environment.locale = window.navigator.userLanguage;
        data.application_environment.is_trial = Windows.ApplicationModel.Store.CurrentApp.licenseInformation.isTrial;
        data.application_environment.is_active = Windows.ApplicationModel.Store.CurrentApp.licenseInformation.isActive;
        data.application_environment.uid = this.config.guid;
        if (typeof (custom_data) !== 'undefined') {
            if ( typeof(custom_data.handled) !== 'undefined' ){
                data.exception.handled = 0;
            }
        }
    }

    return data;
  };

  /**
   * Returns true for Error objects
   * @param  {Object} exception The object to test
   * @return {Boolean}           True for Error objects - [object Error]
   */
  Bugsense.prototype.testException = function bugsenseTestException(exception) {
      // unhandled winjs exceptions
      if (this.config.winjs === true && typeof(exception.detail) !== 'undefined')
          return exception.type === "error";
      // catches handled winjs exceptions as well
      return Object.prototype.toString.call(exception) === '[object Error]';
  };

    /**
     * Returns true if it is an exeption throwed by BugSense
     * @param {Object} exception
     */
  Bugsense.prototype.isBugsenseException = function bugsenseIsBugsenseException(exception) {
      return this.config.winjs && this.testException(exception) && exception.detail.errorMessage === "BugSense exited";
  }

  /**
   * Notify Bugsense about an exception
   * @param  {String} exception   The error message ( also accepts Error Object, will be normalized )
   * @param  {String} url         The originating url
   * @param  {String} line        The line number
   * @param  {Object} custom_data Custom data to send over to Bugsense
   */
  Bugsense.prototype.notify = function bugsenseNotify(exception, url, line, custom_data) {
      var stack;
    // Prints exception stack to console before the exception is handled by Bugsense
      if (window.console && window.console.error) {
        console.error(exception.stack);
      }
    // Handle cases where only Error object and custom data are sent - url will be the custom_data
    if ( arguments.length === 2 && this.testException( exception ) ) { custom_data = url; url = undefined; }

    // If the exception is the full Error object, extract what we want from it
    if ( this.testException( exception ) ) {
      var parsedError = this.parseError( exception );

      message = [ parsedError.type, parsedError.message ].join( ':' );
      url = parsedError.url;
      line = parsedError.line;
      stack = parsedError.stack;
      if (typeof (parsedError.handled) !== 'undefined') {
          if (typeof (custom_data) !== 'object') custom_data = {};
          custom_data.handled = 0;
      }
    } else {
        message = exception;
    }
    
    var data = this.generateExceptionData( message, url, line, stack, custom_data );

    // Send the data over to Bugsense
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open( 'POST', this.getPostURL(), true );
    xmlhttp.setRequestHeader( 'X-BugSense-Api-Key', this.config.apiKey );
    xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xmlhttp.onerror = function (a) {
        if (bugsense.config.winjs) {
            WinJS.Application.local.writeText('CachedCrashReport', JSON.stringify(data)).done(
                function complete() { console.log('written'); window.bugsense._die() }
           );
        }
    }
    if (!(custom_data instanceof Object && custom_data.handled == 0))
        xmlhttp.onreadystatechange = this.successHandler;
    xmlhttp.send(param({ data: JSON.stringify(data) }));

    return true;
  };

    /**
      * Send cashed crash report
      */
  Bugsense.prototype.send_cached_report_if_any = function bugsenseSendCachedReport() {
      var local = WinJS.Application.local;
      local.exists('CachedCrashReport').then(function (exists) {
          if (exists) {
              local.readText('CachedCrashReport').then(function (strdata) {
                  var data = JSON.parse(strdata);
                  // Send the data over to Bugsense
                  var xmlhttp = new XMLHttpRequest();
                  xmlhttp.open('POST', window.bugsense.getPostURL(), true);
                  xmlhttp.setRequestHeader('X-BugSense-Api-Key', window.bugsense.config.apiKey);
                  xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                  xmlhttp.onreadystatechange = function (request) {
                      if (request.target && request.target.readyState == 4) {
                          WinJS.Application.local.remove('CachedCrashReport');
                          return;
                      }
                  };
                  xmlhttp.send(param({ data: JSON.stringify(data) }));
              }).done();
          }
      }).done();
  };

  /**
    * Closure function for unhandled exceptions
    *
    */
  Bugsense.prototype.onerror = function bugsenseonerror(exception, url, line, custom_data) {
      // Ignore bugsense raised exception
      if (window.bugsense.isBugsenseException(exception))
          return false;
      return window.bugsense.notify(exception, url, line, custom_data);
  };

  Bugsense.prototype.onpromiseerror = function bugsenseonpromiseerror(event) {
      // Ignore bugsense raised exception
      if (window.bugsense.isBugsenseException(exception))
          return false;
      return window.bugsense.notify(event.detail.exception, event.detail.promise);
  };

  return Bugsense;

}));