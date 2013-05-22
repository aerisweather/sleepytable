$.fn.SleepyTable = $.fn.SleepyTable || {};
$.fn.SleepyTable.plugins = $.fn.SleepyTable.plugins || {};
(function ($, undefined) {
	
	//Constants
	KEY = {
		ALT     : 'altKey',
		SHIFT   : 'shiftKey',
		CTRL    : 'ctrlKey'
	}
		
	$.fn.SleepyTable.plugins.sort =  {
		//Public - Modifiable
		debug: false,

		/* 
		 * Options per column for sorting, keys are index of header columns.
		 * - enabled - Bool - If sorting should be enabled or not on this table.
		 * Example: colOptions: {0: {enabled: false}}
		 */
		columnOptions    : {},


		/* Current sort order (as array because order matters)
		 * Example: 
		 * sortOrderCurrent = [
		 *     { column: 3, value: 1, varName: "variable5" },
		 *     { column: 1, value: 1, varName: "variable1" }
		 * ];
		 */
		currentOrder  : [],
		additionalKey : KEY.SHIFT, //Holding this button will not clear the current sort.

		/* Config for when data is added to server params for requests.
		 * http://www.example.com/api/?[sortVariable]=[var][sortKeyValue]1[sortDelimeter]
		 * - Default: http://www.example.com/api/?sort=[var]:1,[var2]:-1
		 */
		dataVariable           : 'sort',
		dataKeyValue           : ':',
		dataDelimeter          : ',',

		cssSorterRow          : 'sleepytable-sort-row',
		cssSortActive         : 'sleepytable-sort-active',
		cssSortAsc            : 'sleepytable-sort-asc', //If this class exists (or desc), a <i> will be added to the header automatically
		cssSortDesc           : 'sleepytable-sort-desc', //If this class exists (or asc), a <i> will be added to the header automatically
		cssSortDisabled       : 'sleepytable-sort-disabled',

		cssSortIconBoth       : 'icon-sort-both',
		cssSortIconAsc        : 'icon-sort-asc',
		cssSortIconDesc       : 'icon-sort-desc',

		//Private
		$sortRow      : null,
		$sortHeaders  : [],
		publicMethods : ['advance', 'clear', 'init', 'setAppend', 'setSort'],

		init: function(tableObj) {
			var sorterPlugin,
				config = tableObj.config,
				i,
				orderObj,
				$icon,
				varName,
				thisPlugin = this;;
			//Assume sorting row is the first set of headers.
			this.$sortRow = config.$element.find('thead tr').first().addClass(this.cssSorterRow),
			this.$sortHeaders = this.$sortRow.find('th');

			if (this.$sortRow) {
				for(var i in this.currentOrder) {
					orderObj = this.currentOrder[i];
					if(this.debug) tableObj.debug('Setting initial sort: '+ orderObj.column + ' ' + orderObj.value);
					if (this.columnOptions[orderObj.column] == undefined) this.columnOptions[orderObj.column] = {};
					this.columnOptions[orderObj.column].direction = orderObj.value;
				}

				sorterPlugin = this;
				this.$sortHeaders.each(function (i, elem) {
					var $elem = $(elem);
					if (sorterPlugin.columnOptions[i] == undefined) sorterPlugin.columnOptions[i] = {};
					$icon = $elem.find('i');
					if (!$icon.length && (sorterPlugin.cssSortAsc.length || sorterPlugin.cssSortDesc.length)) {
						$icon = $elem.append('<i class="'+sorterPlugin.cssSortIconBoth+'"/>');
						$icon = $elem.find('i');
					}

					//Check sortOptions for varName
					if (sorterPlugin.columnOptions[i] && sorterPlugin.columnOptions[i].varName !== undefined) {
						varName = sorterPlugin.columnOptions[i].varName
					}
					//Check element for data-var-name
					else if ($elem.data('varName') !== undefined) {
						varName = $elem.data('varName');
					}
					//Use data-src
					else if ($elem.data('src') !== undefined) {
						var dataParts = $elem.data('src').split('[]');
						varName = dataParts.pop();
						if (varName.charAt(0) == '.') varName = varName.substr(1);
					}
					else {
						//Throw error, don't know what variable name this column is.
					}
					sorterPlugin.columnOptions[i].varName = varName;

					if (sorterPlugin.columnOptions[i] && sorterPlugin.columnOptions[i].enabled == false) {
						$elem
							.addClass(sorterPlugin.cssSortDisabled)
							.removeClass(sorterPlugin.cssSortDesc+" "+sorterPlugin.cssSortAsc+" "+sorterPlugin.cssSortActive);
						$icon.removeClass(sorterPlugin.cssSortIconBoth+" "+sorterPlugin.cssSortIconAsc+" "+sorterPlugin.cssSortIconDesc);
					}
					else {
						if (sorterPlugin.columnOptions[i].direction == 1 || sorterPlugin.columnOptions[i].direction == -1)
							config.$element.SleepyTable('plugin.sort.setAppend', i, sorterPlugin.columnOptions[i].direction, false);
						$elem
							.off('click.SleepyTable.plugin.sort')
							.on('click.SleepyTable.plugin.sort', function(event) { 
								if (eval('event.'+sorterPlugin.additionalKey)) {
									config.$element.SleepyTable('plugin.sort.advance', i, event);
								}
								else {
									var direction = sorterPlugin.columnOptions[i].direction;
									config.$element.SleepyTable('plugin.sort.clear', false);
									config.$element.SleepyTable('plugin.sort.setAppend', i, direction, false);
									config.$element.SleepyTable('plugin.sort.advance', i, event);
								}
								config.$element.SleepyTable('plugin.history.sortChange', thisPlugin.currentOrder);
							})
							//IE Disable text selection (should be done with CSS in other browsers)
							.off('onselectstart.SleepyTable.plugin.sort')
							.on('onselectstart.SleepyTable.plugin.sort', function(e) {
								e.preventDefault();
								return false;
							})
					}
				});
			}
		},
		
		headersChanged: function (tableObj, headers) {
			this.init(tableObj);
		},
		
		getFetchParams : function(tableObj, data, dataKeyValue, dataDelimeter) {
			if(dataKeyValue == undefined) {
				dataKeyValue = this.dataKeyValue;
			}
			if(dataDelimeter == undefined) {
				dataDelimeter = this.dataDelimeter;
			}
			
			if(this.debug) {
				tableObj.debug('Building Sort Variables:');
				tableObj.debug(data);
			} 
			if(data == undefined) data = {};
			
			data[this.dataVariable] = '';
			if(this.debug) tableObj.debug('sortOrderCurrent: ');
			if(this.debug) tableObj.debug(this.currentOrder);
			
			var columnId, direction, varName, $header;

			for (i in this.currentOrder) {
				console.log('Looping through current order');
				columnId = this.currentOrder[i].column,
				direction = this.currentOrder[i].value,
				varName = this.currentOrder[i].varName,
				$header = $(this.$sortHeaders[columnId]);

				if ($header.hasClass(this.cssSortActive)) {
					if(this.debug) tableObj.debug(' - Column '+columnId+': '+varName);
					data[this.dataVariable] += varName+dataKeyValue+direction+dataDelimeter;
				}
			}
			return data;
		},
		
		
		/*
		 * Publicly callable methods, call by SleepyTable.plugin.[pluginName].[methodName]
		 */
		advance : function(tableObj, column, event) {
			if(this.debug) debug('sortAdvance');
			var config = tableObj.config,
				direction;

			if (this.columnOptions[column] == undefined) this.columnOptions[column] = {};
			if (this.columnOptions[column].direction == undefined) this.columnOptions[column].direction = 0;
			switch(this.columnOptions[column].direction) {
				case 0: 
					direction = 1;
					break;
				case 1:
					direction = -1;
					break;
				case -1:
					direction = 0;
					break;
			}
			config.$element.SleepyTable('plugin.sort.setAppend', column, direction);
		},

		setAppend : function(tableObj, column, value, updateData) {
			if(this.debug) tableObj.debug('sort.setAppend '+column+" "+value);
			var config = tableObj.config,
				$elem = $(this.$sortHeaders[column]),
				$icon = $elem.find('i');

			if (this.columnOptions[column] == undefined) this.columnOptions[column] = {};
			if (this.columnOptions[column].direction == undefined) this.columnOptions[column].direction = 0;
			
			this.columnOptions[column].direction = value;
			if (this.columnOptions[column].enabled !== false) { 
				switch(this.columnOptions[column].direction) {
					case -1:
					case 'desc':
						$elem
							.addClass(this.cssSortActive+" "+this.cssSortDesc)
							.removeClass(this.cssSortDisabled+" "+this.cssSortAsc);
						$icon
							.addClass(this.cssSortIconDesc)
							.removeClass(this.cssSortIconBoth+" "+this.cssSortIconAsc);
						break;
					case 1:
					case 'asc':
						$elem
							.addClass(this.cssSortActive+" "+this.cssSortAsc)
							.removeClass(this.cssSortDisabled+" "+this.cssSortDesc);
						$icon
							.addClass(this.cssSortIconAsc)
							.removeClass(this.cssSortIconBoth+" "+this.cssSortIconDesc);
						break;
					default:
						//0 and undefined
						$elem
							.removeClass(this.cssSortDisabled+" "+this.cssSortActive+" "+this.cssSortDesc+" "+this.cssSortAsc);
						$icon
							.addClass(this.cssSortIconBoth)
							.removeClass(this.cssSortIconDesc+" "+this.cssSortIconAsc);
						break;
				}
			}

			//If this column is currently sorted, remove it.
			for (var k in this.currentOrder) {
				if (this.currentOrder[k].column == column) {
					this.currentOrder.splice(k, 1);
					break;
				}
			}
			if (value !== 0) {
				this.currentOrder.push({
					column: column, 
					value: this.columnOptions[column].direction,
					varName: this.columnOptions[column].varName
				});
			}

			if (updateData !== false) {
				config.$element.SleepyTable('clearPages');
			}
		},

		clear: function(tableObj, updateData) {
			if(this.debug) tableObj.debug('sort.clear Called');
			this.currentOrder = [];
			var plugin = this;
			this.$sortHeaders.each(function(i) {
				plugin.setAppend(tableObj, i, 0, false);
			});

			if (updateData !== false) {
				config.$element.SleepyTable('clearPages');
			}
		},
		
		setSort: function(tableObj, currentOrder) {
			console.log('setSort sort');
			console.log(currentOrder);
			this.currentOrder = currentOrder;
			this.init(tableObj);
			tableObj.clearPagesActual();
		}
	}
})(jQuery);