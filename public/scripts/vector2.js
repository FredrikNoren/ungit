
var Vector2 = function(x, y) {
	this.x = x;
	this.y = y;
}
Vector2.prototype.length = function() {
	return Math.sqrt(this.x * this.x + this.y * this.y);
}
Vector2.prototype.normalized = function() {
	var length = this.length();
	return new Vector2(this.x / length, this.y / length);
}
Vector2.prototype.sub = function(v) {
	return Vector2.sub(this, v);
}
Vector2.prototype.add = function(v) {
	return Vector2.add(this, v);
}
Vector2.prototype.mul = function(v) {
	return Vector2.mul(this, v);
}
Vector2.sub = function(a, b) {
	return new Vector2(a.x - b.x, a.y - b.y);
}
Vector2.add = function(a, b) {
	return new Vector2(a.x + b.x, a.y + b.y);
}
Vector2.mul = function(a, val) {
	return new Vector2(a.x * val, a.y * val);
}