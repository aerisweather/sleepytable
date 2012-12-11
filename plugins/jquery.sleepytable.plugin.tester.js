$.fn.SleepyTable.plugins.tester = 
{
	myValue: 'default',
	
	init: function(tableObj) {
		console.log('Tester Plugin: init');
		console.log(' - myValue = ' + this.myValue +', saving to tableObj');
		tableObj.config.testValue = this.myValue;
		console.log('Tester Plugin: init END');
	},
	
	headersChanged: function(tableObj, headers) {
		console.log('Tester Plugin: headersChanged');
	},
	
	getFetchParams : function(tableObj, data) {
		console.log('Tester Plugin: getFetchParams');
	},
	
	pageLoaded: function(tableObj, pageData) {
		console.log('Tester Plugin: pageData');
	},
	
	pageLoading: function(tableObj) {
		console.log('Tester Plugin: pageLoad');
	},
	
	pageDisplay: function(tableObj, pageNumber, page, pageRaw) {
		console.log('Tester Plugin: pageDisplay');
	},
	
	clearedPages: function(tableObj) {
		console.log('Tester Plugin: clearedPages');
	}	
}