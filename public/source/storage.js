/**
 * A wrapper aroung LocalStorage to support environments where LocalStorage is not available.
 * Stores and retrieves items from LocalStorage if available and uses a non-persistent cache otherwise.
 */
var storage = {};
module.exports = storage;

storage.cache = {};

/**
 * The getItem() method of the Storage interface, when passed a key name, will return that key's value or null if the key does not exist.
 * @param {string} key A DOMString containing the name of the key you want to retrieve the value of.
 * @returns {string | null} A DOMString containing the value of the key. If the key does not exist, null is returned.
 */
storage.getItem = function (key) {
    if (localStorage) {
        return localStorage.getItem(key);
    } else {
        return this.cache[key] || null;
    }
};

/**
 * The setItem() method of the Storage interface, when passed a key name and value, will add that key to the storage, or update that key's value if it already exists.
 * @param {string} key A DOMString containing the name of the key you want to create/update.
 * @param {string} value A DOMString containing the value you want to give the key you are creating/updating.
 */
storage.setItem = function (key, value) {
    if (localStorage) {
        localStorage.setItem(key, value);
    } else {
        this.cache[key] = value;
    }
};
