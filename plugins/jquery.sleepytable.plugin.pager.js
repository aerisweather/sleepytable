$.fn.SleepyTable = $.fn.SleepyTable || {};
$.fn.SleepyTable.plugins = $.fn.SleepyTable.plugins || {};
(function ($, undefined) {
	
	//Constants
	MODE_HATEOAS = 'hateoas',
	MODE_PAGE    = 'page',

	$.fn.SleepyTable.plugins.pager =  {
		debug: false,
		
		buttons: {
			pageFirst    : {
				enabled : false,
				method   : 'first',
				selector: '.first'
			},
			pagePrevious : {
				enabled : false,
				method   : 'previous',
				selector: '.prev'
			},
			pageNext     : {
				enabled : false,
				method   : 'next',
				selector: '.next'
			},
			pageLast     : {
				enabled : false,
				method   : 'last',
				selector: '.last'
			}
		},
		
		mode : null,
		
		$element       : null, //Jquery Obj containing the paging elements, $("#pager")
		$displayElement: null,
		$limitElement   : null,
		
		displayTemplate : 'Page {pageNumber} ({startRow} to {endRow})',
		loadingTemplate : 'Loading Data...',

		preventEventBubbling: true,
		
		cssGoto    : '.goto-page', // Dropdown to go to a specific page.
		cssDisplay : '.page-display', // A textual representation of the current page.
		cssSize    : '.page-size', // A selector of how many elements the current page should have.
		
		publicMethods : ['setLimit'],
		
		init: function(tableObj) {
			if(this.$element == undefined || this.$element.length == 0)
				if(this.debug) tableObj.debug('No paging element found');
			
			//IE Disable text selection (should be done with CSS in other browsers)
			this.$element.each(function() {
				$(this)
					.off('change.SleepyTable.plugin.pager')
					.on('change.SleepyTable.plugin.pager', function() {
						tableObj.config.$element.SleepyTable('clearPages');
					});
			})
				
			if (tableObj.config.hateoas != null) {
				this.mode = MODE_HATEOAS;
			}
			else {
				this.mode = MODE_PAGE;
			}
			if(this.$displayElement == null) {
				this.$displayElement = this.$element.find(this.cssDisplay);
			}
			if(this.$limitElement == null) {
				this.$limitElement = this.$element.find(this.cssSize);
				var thisPlugin = this;
				this.$limitElement
					.off('change.SleepyTable.plugin.pager')
					.on('change.SleepyTable.plugin.pager', function(e) {
						e.preventDefault();
						tableObj.config.currentPageNumber = 1;
						thisPlugin.getFetchParams(tableObj, {});
						tableObj.config.$element.SleepyTable('clearPages');
						tableObj.config.$element.SleepyTable(
							'plugin.history.pagerChange', 
							{
								limit: tableObj.config.limit,
								page: 1
							}
						);
					});
				this.$limitElement.parent()
					.off('click.SleepyTable.plugin.pager')
					.on('click.SleepyTable.plugin.pager', function(e) {
						e.preventDefault();
					})
			}
			this.pageLoading(tableObj);
		},
		
		getFetchParams : function(tableObj, data) {
			if(this.$limitElement) {
				tableObj.config.limit = parseInt(this.$limitElement.val());
			}
			return data;
		},
		
		pageLoading : function(tableObj) {
			var button;
			for(button in this.buttons) {
				this.disableButton(tableObj, button);
			}
			this.$displayElement.html(this.loadingTemplate);
		},
		
		pageDisplay: function(tableObj, pageNumber, page, pageRaw) {
			if(this.debug) tableObj.debug('Plugin Pager: pageDisplay '+this.mode);
			
			var config = tableObj.config,
				i,
				value,
				pagerOutput;

			//Get paging info from data
			if (page !== undefined) {
				if (this.mode == MODE_HATEOAS) {
					//Loop through each button and update its settings
					for(i in config.hateoas) {
						try {
							if(this.debug) tableObj.debug('Setting Button: ' + i + ', path: ' + config.hateoas[i]);
							value = eval('pageRaw.' + config.hateoas[i]);
							if(this.debug) tableObj.debug('- value: '+ value);
							if (value !== undefined) {
								if(i == 'pageNext' && tableObj.pages[config.currentPageNumber+1] == false)
									this.disableButton(tableObj, i);
								if(i == 'pagePrev' && tableObj.pages[config.currentPageNumber-1] == false)
									this.disableButton(tableObj, i);
								
								this.enableButton(tableObj, i, value);
							}
							else {
								this.disableButton(tableObj, i);
							}
						}
						catch (e) { }
					}
				}
				else if (this.mode == MODE_PAGE){
					for(var button in this.buttons) {
						this.disableButton(tableObj, button);
						switch(button) {
							case 'pageFirst':
								if(tableObj.pages[1] && config.currentPageNumber != 1)
									this.enableButton(tableObj, button);
								break;
							case 'pagePrevious':
								if(tableObj.pages[config.currentPageNumber-1])
									this.enableButton(tableObj, button);
								break;
							case 'pageNext':
								if(tableObj.pages[config.currentPageNumber+1])
									this.enableButton(tableObj, button);
								break;
							case 'pageLast':
								
								break;
						}
					}
				}
				
			}
			if(this.debug) tableObj.debug(this.buttons);
			
			if(this.debug) tableObj.debug('Plugin Pager: Setting Paging display text');
			pagerOutput = this.displayTemplate.replace(/\{(pageNumber|totalPages|startRow|endRow|totalRows)\}/gi, function(m){
				var startRow = (config.page0Based) ? (config.currentPageNumber * config.limit) + 1 : ((config.currentPageNumber - 1) * config.limit) + 1;
				return {
					'{pageNumber}'      : config.currentPageNumber,
					'{totalPages}'      : config.totalPages,
					'{startRow}'        : startRow,
					'{endRow}'          : startRow + config.displayedRowCount - 1,
					'{totalRows}'       : config.totalRows
				}[m];
			});
			
			this.$displayElement.html(pagerOutput);
		},
		
		pageLoaded: function(tableObj, pageNumber, page, pageRaw) {
			this.pageDisplay(tableObj, pageNumber, page, pageRaw);
		},
		
		enableButton : function(tableObj, buttonId, value) {
			if(this.debug) tableObj.debug('Plugin Pager: Enabling Button: ' + buttonId);
			var button = this.buttons[buttonId];
			button.enabled = true;
			button.value = value;
			var pagerPlugin = this;
			this.$element.find(button.selector)
				.off('click.SleepyTable.plugin.pager')
				.on('click.SleepyTable.plugin.pager', function(e) {
					if(pagerPlugin.preventEventBubbling == true) {
						e.preventDefault();
					}
					tableObj.config.$element.SleepyTable(button.method);
					tableObj.config.$element.SleepyTable(
						'plugin.history.pagerChange',
						{
							limit: tableObj.config.limit,
							page: parseInt(tableObj.config.currentPageNumber)
						}
					);
					
				})
				.parent().removeClass('disabled');
		},
		
		disableButton : function(tableObj, buttonId) {
			if(this.debug) tableObj.debug('Plugin Pager: Disabling Button: ' + buttonId);
			var button = this.buttons[buttonId];
			button.enabled = false;
			button.value = null;
			this.$element.find(button.selector)
				.off('click.SleepyTable.plugin.pager')
				.parent().addClass('disabled');
		},
		
		setLimit: function(tableObj, limit) {
			this.$limitElement.val(limit);
		}
	}
})(jQuery);
