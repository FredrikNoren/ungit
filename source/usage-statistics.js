
var keen;

var getKeen = function() {
	if (!keen) {
		keen = require('keen.io').configure({
			projectId: '5240b1d436bf5a753800000c',
			writeKey: 'da0303fb058149813443f1321a139f23420323887b6a4940e82d47d02df451a4a132b938d2e8200a17914e06aa2767dc1a6fa0891db41942918db91a8daa61784d7af2495b934a05111605e4aa4e5c3d92b0b7f8be4d146e05586701894dc35d619443ae234dbc608a36de9ee97e0e1a'
		});
	}
	return keen;
}

exports.addEvent = function(event, data) {
	getKeen().addEvent(event, data);
}