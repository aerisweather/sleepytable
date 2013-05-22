$.fn.SleepyTable = $.fn.SleepyTable || {};
$.fn.SleepyTable.plugins = $.fn.SleepyTable.plugins || {};
(function ($, undefined) {

	$.fn.SleepyTable.plugins.history =  {
		
		keyDelimeter  : '|',
		valueDelimeter: '=',
		historyData   : {},
		
		publicMethods : ['pagerChange', 'filterChange', 'sortChange'],
		
		init: function(tableObj) {
			console.log(tableObj);
			var thisPlugin = this;
			window.addEventListener("popstate", function(e) {
				var location = document.location;
				var state = e.state;
				console.log('History state');
				console.log(state);
				thisPlugin.applyStateObject(tableObj, state);
			});
			
			if(window.location.hash != "") {
				setTimeout(function() { thisPlugin.parseHashString(window.location.hash, tableObj); }, 1);
			}
			
		},
		
		parseHashString: function(hashString, tableObj) {
			if(hashString[0] == '#') {
				hashString = hashString.substring(1);
			}
			var hashParts = hashString.split(this.keyDelimeter);
			var hashData = {};
			hashData.sort = undefined;
			for(var i in hashParts) {
				var valueParts = hashParts[i].split(this.valueDelimeter);
				hashData[valueParts[0]] = JSON.parse(valueParts[1]);
			}
			
			this.applyStateObject(tableObj, hashData);
		},
		
		applyStateObject: function(tableObj, stateObject) {
			console.log('Applying state object?');
			if(typeof stateObject === 'object' && stateObject != null) {
				console.log('-Applying state object');
				if(stateObject.sort != undefined) {
					this.historyData.sort = stateObject.sort;
					console.log("stateObject.sort:");
					console.log(typeof stateObject.sort);
					this.sortApply(tableObj, this.historyData.sort);
				}
				if(stateObject.filter != undefined) {
					this.historyData.filter = stateObject.filter;
					console.log("stateObject.filter:");
					console.log(stateObject.filter);
					this.filterApply(tableObj, this.historyData.filter);
				}

				if(stateObject.pager != undefined) {
					console.log("stateObject.pager:");
					console.log(stateObject.pager);
					this.historyData.pager = stateObject.pager;
					this.pagerApply(tableObj, this.historyData.pager);
				}
			}
		},
		
		pagerChange: function(tableObj, data) {
			this.historyData.pager = data;
			this.pushHistory(this.historyData, 'pagerChange');
		},
		
		pagerApply: function(tableObj, data) {
			console.log('Apply pager history');
			if(data.limit != undefined) {
				tableObj.config.limit = data.limit;
				tableObj.config.$element.SleepyTable('plugin.pager.setLimit', data.limit);
			}
			if(data.page != undefined) {
				console.log('Apply page history');
				setTimeout(
					function() { 
						tableObj.config.$element.SleepyTable('setPage', parseInt(data.page)); 
					}, 1);
			}
		},
		
		sortChange: function(tableObj, data) {
			this.historyData.sort = data;
			this.pushHistory(this.historyData, 'sortChange');
		},
		
		sortApply: function(tableObj, data) {
			if(data != undefined) {
				console.log('Applying sort');
				console.log(data);
				tableObj.config.$element.SleepyTable('plugin.sort.setSort', data);
			}
		},
		
		filterChange: function(tableObj, data) {
			console.log('History: Filter change!!');
			this.historyData.filter = data;
			this.pushHistory(this.historyData, 'filterChange');
		},
		
		filterApply: function(tableObj, data) {
			if(data != undefined) {
				console.log(data);
				for(var column in data) {
					tableObj.config.$element.SleepyTable('plugin.filter.set', column, data[column] ,true);
				}
				
			}
		},
		
		//Helper Methods
		pushHistory: function(data, eventName) {
			
			console.log(this.historyData);
			history.pushState(
				$.extend({}, {'event': eventName}, data),
				null,
				this.createUrl(data));
		},
		
		createUrl: function(data) {
			var url = "#",
				urlData = [],
				pluginName,
				property,
				pluginValue,
				value;
			for(pluginName in data) {
				pluginValue = data[pluginName];
				if(typeof pluginValue == "object") {
					urlData.push(pluginName+this.valueDelimeter+JSON.stringify(pluginValue));
				}
			}
			url += urlData.join(this.keyDelimeter);
			return url;
		}
	}
})(jQuery);