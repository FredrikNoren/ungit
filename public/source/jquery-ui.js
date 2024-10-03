/*
 * Import the autocomplete widget and its dependencies.
 * The current order of the imports is required.
 */

// All files require version, has to go first
require('jquery-ui/ui/version');

// Shared files, used by menu and autocomplete, in alphabetical order
require('jquery-ui/ui/keycode');
require('jquery-ui/ui/position');
require('jquery-ui/ui/unique-id');
require('jquery-ui/ui/widget');

// Required by autocomplete, so has to go before
require('jquery-ui/ui/widgets/menu');

// The autocomplete widget we use
require('jquery-ui/ui/widgets/autocomplete');
