$.fn.SleepyTable = $.fn.SleepyTable || {};
$.fn.SleepyTable.plugins = $.fn.SleepyTable.plugins || {};
(function ($, undefined) {
	
	//Constants
	PLACEHOLDER    = '!-placeholder-!',

	$.fn.SleepyTable.plugins.filter =  {
		//Public - Modifiable
		debug: false,
		/* 
		 * Options per column for sorting, keys are index of header columns.
		 * - enabled - Bool - If sorting should be enabled or not on this table.
		 * Example: filterOptions: {0: {enabled: false}}
		 * Example: filterOptions: {2: {type: select, source: [url]}}
		 * Example: filterOptions: {1: {placeholder: [text]}}
		 */
		columnOptions    : {},
		sleepTime        : 700,
		filterTimer      : null,
		
		cssFilterRow     : 'sleepytable-filter-row',
		cssFilterDisabled: 'sleepytable-filter-disabled',
		
		$filterRow       : null,
		$filterHeaders   : [],
		
		publicMethods : ['set'],
		
		init : function(tableObj) {
			var config = tableObj.config,
				$thead,
				$filterRow,
				$th,
				thisPlugin = this;

			if (config.$headers.length !== 0) {
				$thead = config.$element.find('thead').first();
				$thead.find('tr.'+this.cssFilterRow).remove();
				$filterRow = $('<tr></tr>').addClass(this.cssFilterRow);
				
				filterPlugin = this;
				config.$headers.each(function(i, elem) {
					$th = $('<th></th>');
					if (filterPlugin.columnOptions[i] == undefined) filterPlugin.columnOptions[i] = {};
					if (filterPlugin.columnOptions[i].enabled !== false) {
						if (filterPlugin.columnOptions[i] && filterPlugin.columnOptions[i].type && filterPlugin.columnOptions[i].type.toLowerCase() == 'select') {
							$th.html('<select placeholder="Choose a filter"></select>');
							var $select;
							if (filterPlugin.columnOptions[i].source) {
								//AJAX select box
								$select = $th.find('select');

								$select.html('<option value="'+PLACEHOLDER+'">Loading Options...</option>');
								
								config.ajaxTransport.call(null, {
									url: filterPlugin.columnOptions[i].source,
									dataType: filterPlugin.columnOptions[i].dataType,
									data: filterPlugin.columnOptions[i].data,
									type: filterPlugin.columnOptions[i].httpMethod || 'GET',
									traditional: config.traditionalSerialization,
									context: {
										columnId: i,
										$table: config.$element,
										$element: $select,
										path: filterPlugin.columnOptions[i].options,
										placeholder: filterPlugin.columnOptions[i].placeholder,
										value: filterPlugin.columnOptions[i].value,
										getDynamicPath: filterPlugin.getDynamicPath,
										debug: filterPlugin.debug
									},
									success: function (data) {
										var pathParts = this.path.split("[]"),
											elements =  eval('data.'+pathParts[0]),
											i,
											display,
											options = '';
										if(this.debug) tableObj.debug('Filter value: ' + this.columnId + " to " + this.value);
										for (i in elements) {
											display = eval('data.'+this.getDynamicPath(this.path, i));
											if (display !== undefined) {
												options += '<option value="'+i+'">'+display.toString()+'</option>';
											}
										}
										this.$element.find('option').html(this.placeholder||'Choose filter...');
										this.$element.append(options);
										if (this.value != undefined) {
											if(this.debug) tableObj.debug('Filter AJAX, calling filterSet ' + this.columnId + " to " + this.value);
											this.$table.SleepyTable('plugin.filter.set', this.columnId, this.value);
										}
									},
									error: function (jqXHR, textStatus, errorThrown) {
										this.$element.attr('disabled', true).empty();
									}
								});
							}
							else if (filterPlugin.columnOptions[i].options) {
								//Select box with pre-configured options
								$select = $th.find('select');
								$select.html('<option value="'+PLACEHOLDER+'">'+(filterPlugin.columnOptions[i].placeholder||'Select Filter...')+'</option>');
								for (var j in filterPlugin.columnOptions[i].options) {
									$select.append('<option value="'+j+'">'+filterPlugin.columnOptions[i].options[j]+'</option>');
								}
							}
						}
						else {
							var placeholderText = '';
							if (filterPlugin.columnOptions[i] && filterPlugin.columnOptions[i].placeholder) {
								placeholderText = filterPlugin.columnOptions[i].placeholder
							}
							var valueText = '';
							if (filterPlugin.columnOptions[i] && filterPlugin.columnOptions[i].value !== undefined) {
								valueText = filterPlugin.columnOptions[i].value;
							}
							else {
								filterPlugin.columnOptions[i].value = '';
							}
							$th.html('<input type="search" placeholder="'+placeholderText+'" value="'+valueText+'" />');
						}
					}
					else {
						$th.html('<input type="search" class="'+this.cssFilterDisabled+'" disabled="disabled"></input>');
					}
					$filterRow.append($th);
					$th.find(' > select')
						.off('change.SleepyTable.plugin.filter')
						.on('change.SleepyTable.plugin.filter', function(event) {
							config.$element.SleepyTable('plugin.filter.set', i, $(this).val());
						});
					$th.find(' > input')
						.off('keyup.SleepyTable.plugin.filter, change.SleepyTable.plugin.filter')
						.on('keyup.SleepyTable.plugin.filter, change.SleepyTable.plugin.filter', function(event) {
							if(this.filterTimer != null) {
								clearTimeout(this.filterTimer);
								this.filterTimer = null;
							}
							console.log('Setting value to: '+$(this).val());
							var value = $(this).val();
							this.filterTimer = setTimeout(
								function() {
									console.log('Timout running with: '+ value);
									config.$element.SleepyTable('plugin.filter.set', i, value);
									this.filterTimer = null;
									config.$element.SleepyTable(
										'plugin.history.filterChange', thisPlugin.getFetchParams(tableObj, {}, true)
									);
									
								}
							, filterPlugin.sleepTime);
						});
				});
				$thead.append($filterRow);
				this.$filterHeaders = $filterRow.find('th');
				this.$filterHeaders.each(function(i) {
					if (filterPlugin.columnOptions[i].value !== undefined) {
						config.$element.SleepyTable('plugin.filter.set', i, filterPlugin.columnOptions[i].value, false);
					}
				});
			}
		},
		
		headersChanged: function (tableObj, headers) {
			this.init(tableObj);
		},
		
		getFetchParams : function(tableObj, data, columnIdValueMode) {
			var config = tableObj.config,
				filterPlugin;
				
			if(data == undefined) {
				data = {};
			}
			if(columnIdValueMode == undefined) {
				columnIdValueMode = false;
			}
				
			if(this.debug) {
				tableObj.debug('Filter: ');
				tableObj.debug('filterOptions: ');
				tableObj.debug(this.columnOptions);
			}
			
			filterPlugin = this;
			if(this.$filterHeaders.length) {
				this.$filterHeaders.each(function(columnId) {
					var $header = $(config.$headers[columnId]);
					value = filterPlugin.columnOptions[columnId].value;
					if (value != PLACEHOLDER && value != '' && value != undefined) {
						if (filterPlugin.columnOptions[columnId] && filterPlugin.columnOptions[columnId].varName !== undefined) {
							varName = filterPlugin.columnOptions[columnId].varName
						}
						//Check element for data-var-name
						else if ($header.data('varFilter') !== undefined) {
							varName = $header.data('varFilter');
						}
						//Use data-src
						else if ($header.data('src') !== undefined) {
							var dataParts = $header.data('src').split('[]');
							varName = dataParts.pop();
							if (varName.charAt(0) == '.') varName = varName.substr(1);
						}
						else {
							//Throw error, don't know how to sort this column.
						}
						if(columnIdValueMode) {
							data[columnId] = value;
						}
						else {
							data[varName] = value;
						}
					}
				});
			}
			console.log(data);
			return data;
		},
		
		set: function(tableObj, columnId, value, updateData) {
			if(this.debug) tableObj.debug('Filter Plugin: Setting '+columnId+' to '+value);
			var config = tableObj.config;

			if (this.columnOptions[columnId] == undefined) this.columnOptions[columnId] = {};
			if (this.columnOptions[columnId].value == undefined) this.columnOptions[columnId].value = '';
			
			if(typeof(this.columnOptions[columnId].translation) == 'function') {
				this.columnOptions[columnId].value = this.columnOptions[columnId].translation(value);
			}
			else {
				this.columnOptions[columnId].value = value;
			}
			
			$(this.$filterHeaders[columnId]).children().val(value);

			if (updateData !== false) {
				config.$element.SleepyTable('clearPages');
			}
		},
				
		//Helpers
		getDynamicPath : function(path, index) {
			var splitSrc = path.split("[]");
			return splitSrc[0]+'['+index+']'+splitSrc[1];
		}
	}
})(jQuery);
		

