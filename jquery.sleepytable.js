/* 
 * SleepyTable
 * Copyright 2012 - Media Logic Group Llc.
 * 
 * @todo Set a cap on how many pages get cached.
 */
(function ($, undefined) {
	"use strict";
	if (window.SleepyTable !== undefined) {
        return;
    }
	
	var SleepyTable;
	
		//Paging modes:
	var MODE_HATEOAS = 'hateoas', //Will use hateoas data from config hateoas to change pages (links to next/prev pages is supplied in api response)
		MODE_PAGE    = 'page', //Will use config url template to insert page number
		
		//States the table is in: @todo Finish States
		STATE_INIT     = 'init', //Before data has been triggered to load, still loading plugins.
		STATE_LOADING  = 'loading', //Anytime the table displays the "Loading..." message
		STATE_HAS_DATA = 'hasData' //Table has data displayed to the end user.
	
	//Global Static Functions (thanks to Select2 for some of these)
	function debug(value) {
		if (typeof console !== "undefined" && typeof console.log !== "undefined") {
			console.log(value);
		} else {
			alert(value);
		}
	}

	function benchmark(stringLead, startDate) {
		debug(stringLead + " (" + (new Date().getTime() - startDate.getTime()) + "ms)");
	}
	
	function indexOf(value, array) {
        var i = 0, l = array.length, v;

        if (typeof value === "undefined") {
          return -1;
        }

        if (value.constructor === String) {
            for (; i < l; i = i + 1) if (value.localeCompare(array[i]) === 0) return i;
        } else {
            for (; i < l; i = i + 1) {
                v = array[i];
                if (v.constructor === String) {
                    if (v.localeCompare(value) === 0) return i;
                } else {
                    if (v === value) return i;
                }
            }
        }
        return -1;
    }
	
	function getKeys(obj){
		var keys = [];
		for(var key in obj){
		   keys.push(key);
		}
		return keys;
	 }
	
	
	//Parses a path like "response[].title" and inserts the specified index.
	function getDynamicPath(path, index) {
		var splitSrc = path.split("[]");
		return splitSrc[0]+'['+index+']'+splitSrc[1];
	}
			
	/**
     * Creates a new class
     * Using the clazz method of creating good defaults.
     * @param superClass
     * @param methods
     */
    function clazz(SuperClass, methods) {
        var constructor = function () {};
        constructor.prototype = new SuperClass;
        constructor.prototype.constructor = constructor;
        constructor.prototype.parent = SuperClass.prototype;
        constructor.prototype = $.extend(constructor.prototype, methods);
        return constructor;
    }
	
	//Main SleepyTable object. Here we go.
	SleepyTable = clazz(Object, {
		
		init : function(settings) {
			this.debug = debug; //Copy debug function so our plugins can use it without having to re-define it.
			
			this.config = $.extend(true, {}, $.fn.SleepyTable.defaults, settings); 
			
			this.state = STATE_INIT;
			this.hasInitialized = false;
			if (this.config.debug) {
				debug('Initializing');
				$.data(this, 'startInitTimer', new Date()); 
			}
			if (this.hasInitialized === true) { 
				if (this.config.debug) debug('Already Initialized, aborting.');
				return; 
			}

			//Private non-user modifiable vars.
			this.config.requestHandlers = []; //Keep track of AJAX request handles.
			this.config.$headers = this.config.$element.find('thead tr th');
			this.config.$body = this.config.$element.find('tbody');
			
			//Timer used to wait before sending a request to the servers. Allows for an end user to click/press multiple
			// things before a request is sent to the server.
			this.config.silentTimer = null; 
			this.config.displayedRowCount = 0;

			this.config.$element.data("SleepyTable", this); //Save data to element.
			
			//Class/Theme - For multiple SleepyTable instances on a page with different styling.
			if(this.config.debug) debug('Theme: '+ this.config.theme);

			if (this.config.theme !== '') {
				this.config.$element.addClass('sleepytable-' + this.config.theme);
			}

			//Setup Paging
			this.pages = {};
			this.pagesRaw = {};
			this.addHeaders();
			if (this.config.hateoas != null) {
				this.mode = MODE_HATEOAS;
			}
			else {
				this.mode = MODE_PAGE;
			}
			
			//Instanciate plugins
			// - Hook: init (pseudo called hook('init'), we will call it in order as plugins are loaded.) 
			if(this.config.debug) debug('Loading Plugins...');
			this.plugins = [];
			var pluginName, pluginBase, plugin;
			for(var i in this.config.plugins) {
				pluginName = this.config.plugins[i];
				if(typeof($.fn.SleepyTable.plugins[pluginName]) === "object") {
					pluginBase = $.fn.SleepyTable.plugins[pluginName];
					plugin = $.extend(true, {}, pluginBase, this.config.pluginOptions[pluginName]);
					plugin.name = pluginName;
					this.plugins.push(plugin);
					if(typeof(plugin.init) == 'function') {
						plugin.init(this);
					}
					else {
						if(this.config.debug) debug('Plugin: ' + pluginName + ' has no onInit method');
					}
				}
				else {
					if(this.config.debug) debug('Plugin: ' + pluginName + ' wasn\'t loaded');
				}
			}
			if (typeof(this.config.onInit) === 'function') { this.config.onInit.apply(this); }
			this.hasInitialized = true;
			if (this.config.debug) {
				benchmark("Overall initialization time", $.data( this, 'startInitTimer'));
			}
			//Get our first page for display.
			this.setPage(1);
		},
		
		/**
		 * Called from the clearPages public method. Requests should be filtered out by the clearPages method to only once
		 * evey so often as it creates AJAX requests.
		 */
		clearPagesActual : function () {
			if(this.config.debug) debug('Clearing pages...');
			this.pages = {};
			this.pagesRaw = {};
			this.hook('clearedPages');
			this.setPage(1);
		},
		
		
		addHeaders : function(header) {
			if(this.config.debug) {
				debug('addHeaders');
				debug(header);
			} 
			var config = this.config,
				attrib,
				i;
			if (header != undefined) {
				config.$element.find('thead').remove();
				var $tableHeader = $("<thead></thead>");
				var $tableRow = $("<tr></tr>");
				for (attrib in header) {
					if (attrib != 'content') {
						$tableRow.attr(attrib, header[attrib]);
					}
				}
				$tableRow.addClass(config.cssHeaderRow);

				var headerSettings;

				for (i in header.content) {
					headerSettings = header.content[i];
					var $th = $("<th></th>");

					for (attrib in headerSettings) {
						if (attrib == 'content') {
							$th.html(headerSettings[attrib]); 
						}
						else {
							$th.attr(attrib, headerSettings[attrib]);
						}
					}
					$tableRow.append($th);
				}
				var $headerRow = $tableHeader.append($tableRow);
				config.$element.prepend($headerRow);
				config.$headers = $tableRow.find('th');
				this.hook('headersChanged', config.$headers);
			}
			config.$element.find('thead').addClass(config.cssHeader);
		},

		renderPage : function(pageNumber) {
			if(this.config.debug) debug('renderPage: '+pageNumber);
			var config = this.config,
				page = this.pages[pageNumber],
				pageRaw = this.pagesRaw[pageNumber];

			if (page) {
				//If no headers and this one has headers, use these.
				if (page.headers && page.headers.content.length && config.$headers.length == 0) {
					if(config.debug) debug('Add page headers');
					this.addHeaders(page.headers);
				}
				
				if(config.heightFixed) {
					var preHeight = config.$element.height();
					config.$element.css('height', 'auto');
				}
				
				//Ensure we have a table body
				if (config.$body.length == 0) {
					config.$element.append('<tbody></tbody>');
					config.$body = config.$element.find('tbody');
					if(config.debug) { 
						debug('Missed finding tbody, added one.');
						debug(config.$body[0]);
					}
				}
				else {
					config.$element.find('tbody').empty();
				}
				config.displayedRowCount = 0;
				
				
				//Add Rows
				for (var i in page.rows) {
					if(config.debug) debug('Rending row...');
					config.displayedRowCount++;
					this.addRow(i, page.rows[i], pageRaw);
				}
				
				if(config.heightFixed) {
					var currentHeight = config.$element.height();
					if(currentHeight > preHeight) preHeight = currentHeight;
					config.$element.css('height', preHeight);
				}
				this.hook('pageDisplay', pageNumber, page, pageRaw);
			}
			else {
				config.$element.find('tbody').empty().append(config.emptyRowHtml);
			}
		},

		addRow : function(rowNumber, rowData, pageRaw) {
			var config = this.config,
				$body = config.$body,
				attrib,
				tdAttrib,
				$tr = $('<tr></tr>'),
				$td,
				i,
				value;
			
			if(typeof(this.config.onRenderRow) == 'function' ) {
				if(this.config.rawRowDataSelection != null && pageRaw) {
					//Use the raw data, if we can find it.
					$tr = $(this.config.onRenderRow(pageRaw[this.config.rawRowDataSelection][rowNumber]));
				}
				else {
					//No raw data selector, just
					$tr = $(this.config.onRenderRow(rowData));
				}
			}
			else {
				for (attrib in rowData) {
					if (attrib == 'content') {
						for (i in rowData[attrib]) {
							$td = $('<td></td>');
							for (tdAttrib in rowData['content'][i]) {
								value = rowData['content'][i][tdAttrib];
								if (value != undefined) {
									if (tdAttrib == 'content') {
										$td.html(value.toString());
									}
									else {
										$td.attr(tdAttrib, value.toString());
									}
								}
							}
							$tr.append($td);
						}
					}
					else {
						value = rowData[attrib];
						if (value != undefined)
							$tr.attr(attrib, value.toString());
					}
				}
			}
			if(config.debug) {
				debug('Appending row to: ');
				debug($body[0]);
			}
			$body.append($tr);
		},

		print : function() {
			//Fetch and display all data
			//Max amount of data?
		},
		
		/**
		 * Calls events by the passed "eventName" plus any other args. 
		 * Will also call a config function by the name of on[EventName] (i.e., eventName = init, this.config.onInit() will get called)
		 */
		hook : function(eventName) {
			if(this.config.debug) debug('Hook: '+eventName);
			var pluginName = '',
				plugin,
				pluginArgs,
				newArgs,
				returnValue;
				
			newArgs = Array.prototype.slice.call(arguments); //Best Mozilla recommended way to duplicate arguments into an array.
			//Peel off the name, add back our object. Hook functions should be hookFunction(sleepytableObj, [other args...])
			newArgs.shift();
			newArgs.unshift(this);
			for(var i in this.plugins) {
				plugin = this.plugins[i];
				//if(this.config.debug) debug('Hook: '+eventName+' in '+this.config.plugins[i]);
				if(typeof(plugin) === "object" && typeof(plugin[eventName]) == "function") {
					//Do we want to change the context of "this", I say nay.
					returnValue = $.extend(true, {}, returnValue, plugin[eventName].apply(plugin, newArgs));
				}
				else {
					//if(this.config.debug) debug('- not a function');
				}
			}
			//Call config event.
			var funcName = 'on'+eventName.charAt(0).toUpperCase()+eventName.substr(1);
			if(typeof(this.config[funcName]) == 'function') {
				newArgs.shift(); //Take off refence to table. Will be "this" in function
				returnValue = $.extend(true, {}, returnValue, this.config[funcName].apply(this, newArgs));
			}
			//debug('Hook returns: ');
			//debug(returnValue);
			return returnValue;
		},

		/*******************
		 * PUBLIC METHODS *
		 ******************/		
		fetchPage : function(pageNumber) {
			//Event FetchDataStart
			if(this.config.debug) debug('Fetching page: ' + pageNumber);
			var config = this.config,
				url,
				i,
				pageOffset,
				data,
				value,
				transport = config.ajaxTransport,
				handler;

			if(pageNumber == this.config.currentPageNumber) {
				//Loading current page.
				//Empty our table body, add loading
				if (this.config.$body.length != 0) {
					var $body = this.config.$body,
						height = $body.outerHeight();

					$body.empty().append(config.loadingRowHtml);
					$body.find('tr').css('height', height);
				}
				this.hook('pageLoading');
				this.state = STATE_LOADING;
			}
			
			//Get Fetch Params - Important to be before URL parsing, in case a plugin modifies limit or something
			data = {};
			data = this.hook('getFetchParams', data);

			if (config.page0Based) {
				pageOffset = config.offsetInitial + ((pageNumber) * config.limit);
			}
			else {
				pageOffset = config.offsetInitial + ((pageNumber-1) * config.limit);
			}
			
			var url = '';
			
			if(this.config.debug) debug('Pages raw: ');
			if(this.config.debug) debug(this.pagesRaw);
			//Check for hateoas 
			if(this.mode == MODE_HATEOAS) {
				if(this.pagesRaw[pageNumber-1] != undefined && config.hateoas.pageNext) {
					url = eval('this.pagesRaw[pageNumber-1].' + config.hateoas.pageNext);
				}
				else if(this.pagesRaw[pageNumber+1] != undefined && config.hateoas.pagePrevious) {
					url = eval('this.pagesRaw[pageNumber+1].' + config.hateoas.pagePrevious);
				}
			}
			
			if(url == '') {
				//Else URL replacement
				url = config.url.replace(
					/\{(page|offset|limit)\}/gi, 
					function(m){
						return {
							'{page}'            : pageNumber,
							'{offset}'          : pageOffset,
							'{limit}'           : config.limit
						}[m];
				});
			}
			
			//debug('Sort options: '+data[config.sortVariable]);

			//Format data
			//-Use callback,
			//-Use default
			if (typeof(transport) !== 'function') {
				if(this.config.debug) debug('transport setting isn\'t a valid funciton');
			}
			handler = transport.call(null, {
				url: url,
				dataType: config.dataType,
				data: data,
				type: config.httpMethod,
				traditional: config.traditionalSerialization,
				pageNumber: pageNumber,
				context: this,
				success: function (data) {
					if (typeof(this.config.ajaxProcessing) === 'function') {
						var pageData = this.config.ajaxProcessing.call(null, data);
					}
					else {
						//Check table headers to map to data
						var pageData = { rows: [] },
							row = 0,
							moreRows = false,
							colValue = '',
							i,
							rows,
							splitSrc;
						do {
							moreRows = false;
							
							//No headers, try and get them from the data.
							if(this.config.$headers.length == 0 && this.config.rawRowDataSelection != null) {
								rows = eval('data.'+this.config.rawRowDataSelection);
								
								if(rows && rows.length) {
									var headerObj = { content: [] },
										headers = getKeys(rows[0]),
										i;
									for(var i in headers) {
										headerObj.content[i] = {}
										headerObj.content[i].content = headers[i]
											.replace(/([A-Z])/g, ' $1')
											// uppercase the first character
											.replace(/^./, function(str){ return str.toUpperCase(); });
										headerObj.content[i]['data-var-name'] = headers[i];
											
									}
									this.addHeaders(headerObj);
								}
							}
							
							if(this.config.rawRowDataSelection != null) {
								//Row centric approach. Columns don't define where to get data.
								rows = eval('data.'+this.config.rawRowDataSelection);
								if(rows && rows.length) {
									for(i in rows) {
										if (typeof(pageData.rows[i]) == "undefined") 
											pageData.rows[i] = { content: []};
										for(var key in rows[i]) {
											colValue = rows[i][key];
											pageData.rows[i].content.push({ content: colValue })
										}
										
									}
								}
							}
							else if(this.config.$headers.length) {
								//Column centric, columns define where to get the data
								this.config.$headers.each(function(index) {
									try {
										if($(this).data('src') != undefined) {
											colValue = eval('data.'+getDynamicPath($(this).data('src'), row));
											if (typeof(pageData.rows[row]) == "undefined") 
												pageData.rows[row] = { content: []};

											pageData.rows[row].content.push({ content: colValue });

											if (moreRows == false && eval('data.'+getDynamicPath($(this).data('src'), row+1)) != undefined)
												moreRows = true;
											}
										}
									catch (e) { }
								});
								row++;
							} 
						}
						while(moreRows);
						
						if(pageData.rows.length > 0) {
							this.pages[pageNumber] = pageData;
							this.pagesRaw[pageNumber] = data;
						}
						else {
							this.pages[pageNumber] = false;
							this.pagesRaw[pageNumber] = data;
						}
						
					}
					this.hook('pageLoaded', pageNumber, pageData, data);
					if(this.config.debug) debug('Got page: '+pageNumber);
					if(pageNumber == this.config.currentPageNumber)
						this.renderPage(pageNumber);
					
				},
				error: function (jqXHR, textStatus, errorThrown) {
					if(this.config.debug) debug('Page ' + pageNumber + ' doesn\'t exist.');
					this.pages[pageNumber] = false;
					this.pagesRaw[pageNumber] = data;
				}
			});
			config.requestHandlers.push(handler);
		},
		
		setPage : function(pageNumber) {
			if(this.pages[pageNumber] == undefined) {
				this.config.currentPageNumber = pageNumber;
				this.fetchPage(pageNumber);
			}
			else if(this.pages[pageNumber] == false) {
				
			}
			else {
				if(this.config.debug) debug('Rendering existing page');
				this.config.currentPageNumber = pageNumber;
				this.renderPage(pageNumber);
			}
			//Pre-fetch
			if(this.config.preLoadNextPage) {
				if(this.pages[this.config.currentPageNumber + 1] == undefined)
					this.fetchPage(this.config.currentPageNumber + 1);
				if(this.config.currentPageNumber > 1 && this.pages[this.config.currentPageNumber - 1] == undefined) {
					this.fetchPage(this.config.currentPageNumber - 1);
				}
			}
		},
		
		clearPages : function() {
			if(this.config.silentTimer != null)
				this.config.silentTimer.clearTimeout();
			var sleepyTableInstance = this;
			this.config.silentTimer = setTimeout(function() { sleepyTableInstance.clearPagesActual(); sleepyTableInstance.config.silentTimer = null; }, this.config.silentDelay);
		},

		first : function() {
			this.setPage(1);
		},
		
		previous : function() {
			if (this.config.currentPageNumber > 1)
				this.setPage(this.config.currentPageNumber - 1);
		},
		
		next : function() {
			this.setPage(this.config.currentPageNumber + 1);
		},
		
		last : function() {
			if(this.config.debug) debug('Not implemented yet.');
		}		
	});
		
	$.fn.SleepyTable = function () {
		var args = Array.prototype.slice.call(arguments, 0),
            opts,
            sleepyTable,
            value,
			allowedMethods = ['container', 'fetchData', 'setPage', 'clearPages', 'first', 'previous', 'next', 'last', 'sortAdvance', 'sortSetAppend', 'sortClear', 'filterSet'];

        this.each(function () {
            if (args.length === 0 || typeof(args[0]) === "object") {
                opts = args.length === 0 ? {} : $.extend({}, args[0]);
                opts.$element = $(this);

                sleepyTable = new SleepyTable();
                sleepyTable.init(opts);
            } else if (typeof(args[0]) === "string") {
				value = undefined;
                sleepyTable = $(this).data("SleepyTable");
				var pluginMethod = false,
						plugin,
						pluginName,
						pluginCursor, j;
                if (indexOf(args[0], allowedMethods) == -1) {
					if(sleepyTable.plugins instanceof Array) {
						for(pluginCursor in sleepyTable.plugins) {
							plugin = sleepyTable.plugins[pluginCursor];
							pluginName = sleepyTable.config.plugins[pluginCursor];
							if(plugin.publicMethods instanceof Array) {
								for(j in plugin.publicMethods) {
									//console.log('Checking plugin method: '+'plugin.' + pluginName + '.' + plugin.publicMethods[j]);
									if('plugin.' + pluginName + '.' + plugin.publicMethods[j] == args[0]) {
										pluginMethod = true;
										break;
									}
								}
							}
							if(pluginMethod == true) break;
						}
					}
					//console.log(pluginMethod+' '+args[0]);
					if(pluginMethod === false) {
						if(pluginName) {
							var methodParts = args[0].split('.');
							var pluginFound = false;
							for(pluginCursor in sleepyTable.plugins) {
								if(sleepyTable.plugins[pluginCursor].name == methodParts[1]) {
									pluginFound = true;
									break;
								}
							}
							if(!pluginFound) {
								if(sleepyTable.config.debug)
									debug('Plugin: '+methodParts[1]+' isn\'t loaded');
							}
							else {
								if(sleepyTable.config.debug)
									debug(methodParts[1]+' Plugin Method: '+methodParts[2]+' isn\'t a valid method');
							}
						}
						else {
							throw "Unknown method: " + args[0];
						}
					}
                }
                
                if (sleepyTable === undefined) return;
				
                if (args[0] === "container") {
                    value = sleepyTable.container;
                } 
				else {
					try {
						if(pluginMethod) {
							var newArgs = args.slice(1);
							newArgs.unshift(sleepyTable);
							//console.log(plugin[plugin.publicMethods[j]]);
							value = plugin[plugin.publicMethods[j]].apply(plugin, newArgs);
						}
						else
							value = sleepyTable[args[0]].apply(sleepyTable, args.slice(1));
					}
					catch (err) {
						//console.log('Method not found: ' + args[0]);
						//console.log(args);
					}
                }
                if (value !== undefined) {return false;}
            } else {
                throw "Invalid arguments to sleepyTable plugin: " + args;
            }
        });
        return (value === undefined) ? this : value;
	}
	
	// Default config values
    $.fn.SleepyTable.defaults = {
		// Appearance
		debug            : false,
		
		theme            : 'default',  // adds sleepytable-{theme} to the table for styling
		widthFixed       : false,      // adds colgroup to fix widths of columns
		heightFixed      : true,

		//Data
		url              : 'http://www.example.com/api/?page={page}&limit={limit}',
		ajaxProcessing   : null, //Example: function(data) { return {header: [], rows: [data], totalRows: 0}},
		ajaxTransport    : $.ajax,
		
		dataType         : 'jsonp',
		httpMethod       : 'GET',
		traditionalSerialization: false,
		currentPageNumber: 1,
		page0Based       : false,
		offsetInitial    : 0, //Initial value, added to page*limit, later
		limit            : 10, 
		hateoas          : null,
		/*
		hateoas          : {           // Allows for HATEOAS pagination
			pageFirst     : 'links.first',
			pagePrevious  : 'links.prev',
			pageNext      : 'links.next',
			pageLast      : 'links.last'
		},
		*/
	    preLoadNextPage  : true,
		silentDelay      : 500,
		
		
	    loadingRowHtml   : '<tr class="sleepytable-loading"><td colspan="9999"><img src="assets/loading.gif"/> Loading...</td></tr>',
		emptyRowHtml     : '<tr class="sleepytable-empty"><td colspan="9999">[No entries]</td></tr>',
		
		rawRowDataSelection : null, //How to split out the raw response data into rows. Used if data-src isn't set
		
		// plugins
		plugins             : [],      // method to add widgets, e.g. widgets: ['zebra']
		pluginOptions       : {},

		// Callbacks - Same as hooks, just prefaced with "on". Hopefully easy for users to use. Get called after plugins.
		onInit:             null,
		onHeaderChanges:    null,
		onGetFetchParams:   null,
		onPageLoaded:       null,
		onPageLoading:      null,
		onPageDisplay:      null,
		onClearedPages:     null,
		
		// css class names
		cssTable         : 'sleepytable',
		cssHeader        : 'sleepytable-header',
		
		cssIcon          : 'sleepytable-icon', 
		cssInfoBlock     : 'sleepytable-infoOnly', // don't sort tbody with this class name
		cssProcessing    : 'sleepytable-processing' // processing icon applied to header during sort/filter		
	};
	
	$.fn.SleepyTable.plugins = {} //Container for plugin defaults
	
	// exports
    window.SleepyTable = {};
	
})(jQuery);