
var expect = require('expect.js');
var Vector2 = require('../source/utils/vector2.js');

describe('Vector2', function() {
	it('should be addable', function() {
		var a = new Vector2(5, 2);
		var b = new Vector2(8, 10);
		var c = a.add(b);
		expect(c.x).to.be(a.x + b.x);
		expect(c.y).to.be(a.y + b.y);
	})
})