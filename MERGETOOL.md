If you have your own merge tool that you would like to use, such as Kaleidoscope or p4merge, you can configure ungit to use it by following these steps:  


1. Configuring git
------------------

The first step is to configure git so that it knows how to invoke your merge tool. In your home directory, open (or create) the git configuration file .gitconfig. In this file, you will want to add information about your merge tool, it should look something like this:

```ini
[mergetool "extMerge"]
	cmd = extMergeTool "$BASE" "$LOCAL" "$REMOTE" "$MERGED"
	trustExitCode = false
```

* `"extMergeTool"` is the merge tool you are invoking. This assumes your merge tool was installed and the command is recognized by your system. You may also replace this with the path to your merge tool directly.
* For best results, refer to the documentation of your merge tool, as it may require different command arguments.
* The name `"extMerge"` can be whatever you want. I recommend that it not contain spaces or special symbols, as it may interfere when used as a command argument.
* `"trustExitCode"` depends on the merge tool you are using. If `true`, git will use the return code of your merge tool to determine whether the conflict has been resolved, otherwise it will use the timestamp of the file to determine this (meaning if your merge tool saved over the file, it will assume it has been resolved).
* Additionally, you can also provide the following if you want to identify your merge tool as the default:

```ini
[merge]
	tool = extMerge
```

If you wish to test your configuration, open a console in a git repo that is currently waiting for conflict resolution and type the following command:
`> git mergetool --tool extMerge`
This should invoke your merge tool and cycle through each conflicted file.


2. Configuring ungit
--------------------

Add the `"mergeTool"` option to your ungit configuration file (.ungitrc). Set this value to `true` if you have configured a default merge tool with git, otherwise use the name of the merge tool you have configured (for example `"extMerge"`). It should look something like this:

```json
{
	"mergeTool": "extMerge"
}
```

3. Use ungit's interface
------------------------

Start ungit and navigate to a repo with conflicted files. Now when you hover over the `Conflicts` label displayed on one of the conflicted files, it should expand and give you an option to `Launch Merge Tool`.

Once you have used your merge tool to resolve the conflicts, if ungit does not immediately recognize this, you may use the `Mark as Resolved` button to manually tell git that the file is now resolved.


4. Known Issues and Troubleshooting
-----------------------------------

* In some cases, your merge tool may take a few seconds to launch. Pressing the launch button multiple times will cause your merge tool to launch that many copies.
* Some merge tools (like `vimdiff`) are terminal-only tools and will not work with ungit. Your merge tool must work in a windowed environment. See the suggested merge tool section below.
* If for any reason git does not recognize that your merge tool has resolved the file, `trustExitCode` may need to be set to `false`.
* When your merge tool is launched, four auto-generated files will appear. If you have `trustExitCode` set to `false` and you cancel the merge tool, it may leave the generated files there. In this case, it is safe to manually remove them.


5. Merge Tool Suggestions
-------------------------
* Mac OS X:
	* Meld: [meldmerge.org](http://meldmerge.org)
  * Kaleidoscope: [www.kaleidoscopeapp.com](http://www.kaleidoscopeapp.com)
  * Araxis Merge: [www.araxis.com](http://www.araxis.com)
  * DeltaWalker: [www.deltopia.com](http://www.deltopia.com)
* Windows:
  * Beyond Compare: [www.scootersoftware.com](http://www.scootersoftware.com)
  * Araxis Merge: [www.araxis.com](http://www.araxis.com)
  * P4Merge: [www.perforce.com](http://www.perforce.com)
