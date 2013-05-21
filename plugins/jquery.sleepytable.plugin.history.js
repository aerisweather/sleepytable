$.fn.SleepyTable = $.fn.SleepyTable || {};
$.fn.SleepyTable.plugins = $.fn.SleepyTable.plugins || {};
(function ($, undefined) {

	$.fn.SleepyTable.plugins.history =  {
		
		init: function(tableObj) {
			console.log(tableObj);
			var thisPlugin = this;
			window.addEventListener("popstate", function(e) {
				var location = document.location;
				var state = e.state;
				if(state) {
					switch(state.event) {
						case 'pagerButtonClick':
							console.log('History: Pager has state:');
							console.log(state);
							thisPlugin.pluginPagerApply(state, tableObj);
							break;
					}
					
				}
			});
			
		},
		
		pluginPagerChange: function(tableObj) {
			console.log('Captured PAGER BUTTON CLICK!!!');
			var currentPage = tableObj.config.currentPageNumber,
				currentLimit = tableObj.config.limit;
				
			var data = {
				'page': currentPage,
				'limit': currentLimit
			};
			
			this.pushHistory(data, 'pagerButtonClick');
			
			console.log(tableObj);
			console.log(history.state);
		},
		
		pluginPagerApply: function(data, tableObj) {
			if(data.limit != undefined) {
				tableObj.config.limit = data.limit;
			}
			if(data.page != undefined) {
				tableObj.config.$element.SleepyTable('setPage', data.page);
			}
		},
		
		pushHistory: function(data, eventName) {
			history.pushState(
				$.extend({}, {'event': eventName}, data),
				null,
				this.createUrl(data));
		},
		
		createUrl: function(data) {
			var url = "#",
				urlData = [],
				property,
				value;
			for(property in data) {
				value = data[property];
				urlData.push(property+':'+value);
			}
			url += urlData.join(',');
			return url;
		}
	}
})(jQuery);