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
Just restart Ungit, or if you have `"dev": true` in your `.ungitrc` you can just refresh your browser.

### More examples

All the components in Ungit is built as plugins, take a look in the `components` directory for inspiration. Or take a look at the [gerrit plugin](https://github.com/FredrikNoren/ungit-gerrit) which is a complete example of how a plugin can look.

### Ungit Plugin API version
The Ungit Plugin API follows semver, and the current version can be found in the package.json (ungitPluginApiVersion). On the frontend it can be accessed from `ungit.pluginApiVersion` and on the backend `env.pluginApiVersion`.
