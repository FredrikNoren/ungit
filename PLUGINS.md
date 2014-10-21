Writing Ungit plugins
=====================

It's super easy to write an Ungit plugin. Here's how to write a completely new (though super simple) git log ui:

### 1. Create a new folder for your plugin.
Create a folder at `~/.ungit/plugins/MY_FANCY_PLUGIN`, then add a file called `ungit-plugin.json` with the following content:
```JSON
{
  "exports": {
    "javascript": "example.js"
  }
}
```

### 2. Add some code
Create an `example.js` file and add this:

```JavaScript
var components = require('ungit-components');

// We're overriding the graph component here
components.register('graph', function(args) {
  return {
    // This method creates and returns the DOM node that represents this component.
    updateNode: function() {
      var node = document.createElement('div');
      // Request all log entries from the backend
      args.server.get('/log', { path: args.repoPath, limit: 50 }, function(err, log) {
        // Add all log entries to the parent node
        log.forEach(function(entry) {
          var entryNode = document.createElement('div');
          entryNode.innerHTML = entry.message;
          node.appendChild(entryNode);
        });
      });
      return node;
    }
  };
});
```

### 3. Done!
Just restart Ungit, or if you have `"dev": true` in your `.ungitrc` you can just refresh your browser.  A [gerrit plugin example](https://github.com/FredrikNoren/ungit-gerrit) can be found here.

### Ungit Plugin API version
The Ungit Plugin API follows semver, and the current version can be found in the package.json (ungitPluginApiVersion). On the frontend it can be accessed from `ungit.pluginApiVersion` and on the backend `env.pluginApiVersion`.

### Components

Each functionalities within ungit is built as components.  Each components is an ungit plugin that is checked into main repository.  All the components in Ungit is built as plugins, take a look in the [components](https://github.com/FredrikNoren/ungit/tree/master/components) directory for inspiration.

An [example](https://github.com/FredrikNoren/ungit/tree/master/components/staging) of ungit component with view can be seen below.

```JSON
{
  "exports": {
    "knockoutTemplates": {
      "staging": "staging.html"
    },
    "javascript": "staging.bundle.js",
    "css": "staging.css"
  }
}
```

* Views(html) for Component

   Each component can have multiple views as exampled [here](https://github.com/FredrikNoren/ungit/tree/master/components/dialogs).

* CSS for Component
   css file can be easily defined per components and in above example we can see that `staging.less` file is compiled into `staging.css` via grunt job.  If you are using less file please modify [Gruntfile.js](https://github.com/FredrikNoren/ungit/blob/master/Gruntfile.js) file to include new less file.

* JS for Component

   Each component gets to have one javascipt files.  However each javasciprt file can require other javascript in it's directory or other libraries.  If you are doing require by relative pass as exampled in [graph.js](https://github.com/FredrikNoren/ungit/blob/master/components/graph/graph.js), you wouldn't have to include the js in browserify job in [Gruntfile.js](https://github.com/FredrikNoren/ungit/blob/master/Gruntfile.js).
