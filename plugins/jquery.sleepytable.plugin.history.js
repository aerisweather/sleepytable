$.fn.SleepyTable = $.fn.SleepyTable || {};
$.fn.SleepyTable.plugins = $.fn.SleepyTable.plugins || {};
(function ($, undefined) {

	$.fn.SleepyTable.plugins.history =  {
		
		debug: false,
		keyDelimeter  : '|',
		valueDelimeter: '=',
		historyData   : {},
		
		publicMethods : ['pagerChange', 'filterChange', 'sortChange'],
		
		init: function(tableObj) {
			var thisPlugin = this;
			window.addEventListener("popstate", function(e) {
				var location = document.location;
				var state = e.state;
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
			if(this.debug) 
				tableObj.debug('Applying state object?');
			if(typeof stateObject === 'object' && stateObject != null) {
				if(this.debug) tableObj.debug('-Applying state object');
				if(stateObject.sort != undefined) {
					this.historyData.sort = stateObject.sort;
					if(this.debug) {
						tableObj.debug("stateObject.sort:");
						tableObj.debug(typeof stateObject.sort);
					}
					this.sortApply(tableObj, this.historyData.sort);
				}
				if(stateObject.filter != undefined) {
					this.historyData.filter = stateObject.filter;
					if(this.debug) { 
						tableObj.debug("stateObject.filter:");
						tableObj.debug(stateObject.filter);
					}
					this.filterApply(tableObj, this.historyData.filter);
				}

				if(stateObject.pager != undefined) {
					if(this.debug) {
						tableObj.debug("stateObject.pager:");
						tableObj.debug(stateObject.pager);
					} 
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
			if(this.debug) tableObj.debug('Apply pager history');
			if(data.limit != undefined) {
				tableObj.config.limit = data.limit;
				tableObj.config.$element.SleepyTable('plugin.pager.setLimit', data.limit);
			}
			if(data.page != undefined) {
				if(this.debug) tableObj.debug('Apply page history');
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
				if(this.debug) tableObj.debug('Applying sort');
				if(this.debug) tableObj.debug(data);
				tableObj.config.$element.SleepyTable('plugin.sort.setSort', data);
			}
		},
		
		filterChange: function(tableObj, data) {
			if(this.debug) tableObj.debug('History: Filter change!!');
			this.historyData.filter = data;
			this.pushHistory(this.historyData, 'filterChange');
		},
		
		filterApply: function(tableObj, data) {
			if(data != undefined) {
				if(this.debug) tableObj.debug(data);
				for(var column in data) {
					tableObj.config.$element.SleepyTable('plugin.filter.set', column, data[column] ,true);
				}
				
			}
		},
		
		//Helper Methods
		pushHistory: function(data, eventName) {
			
			if(this.debug) tableObj.debug(this.historyData);
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