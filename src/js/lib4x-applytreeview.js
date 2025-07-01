window.lib4x = window.lib4x || {};
window.lib4x.axt = window.lib4x.axt || {};

/*
 * LIB4X Apply Tree View
 * Enables a tree view to grids: where there is an HTML table and a model behind. 
 * Primarily meant for Popup LOV dialog, but it can also be applied to IG.
 * The model data based on an hierarchical query.
 */
lib4x.axt.applyTreeView = (function($)
{

    //==popupLov module
    let popupLovModule = (function() 
    {
        // get the APEX item element which opens the dialog/popup
        // it won't give a result if the dialog is not opened from the current page
        function getDialogParentElement(dialog$)
        {
            let opener = {};
            let currentPageNr = $('#pFlowStepId').val();
            // dialog id examples: PopupLov_69_P69_POPUP_LOV_dlg, example: CS_69_P69_AUTOCOMPLETE, P69_COLOR_PICKER_ColorPickerDlg, P69_DATE_dialog
            let match = dialog$.id.match(/^(?:(?:PopupLov|CS)_(\d+)_(.+?)(?:_dlg)?|([a-zA-Z0-9_$]+(?:_[a-zA-Z0-9_$]+)*)_(?:ColorPickerDlg|dialog))$/);
            if (match)
            {
                opener.itemId = match[2] || match[3];
                // if pageNr is not in the dialog id, check if the item is on the current page
                opener.pageNr = match[1] || apex.item(opener.itemId).element.length ? currentPageNr : null;
            }
            return opener.pageNr == currentPageNr ? apex.item(opener.itemId).element : $();
        } 

        // initialize the popup lov with the treeview
        // the LOV shared component will have additional columns defined (LEVEL, IS_LEAF etc)
        // from which the Popup LOV will be instantiated with a Grid (as opposed to an iconlist)
        $(function(){
            let topApex = apex.util.getTopApex();
            topApex.jQuery(topApex.gPageContext$).on("popupopen dialogopen", '.a-PopupLOV-dialog', function(jQueryEvent, data) { 
                let parentElement$ = getDialogParentElement(jQueryEvent.target);   
                if (parentElement$.length)    // if length, then we know the parent element is on the current page
                {        
                    let popupLovResults$ = $(jQueryEvent.target).find('.a-PopupLOV-results');
                    let view = popupLovResults$.data('apexGrid');
                    // check from grid.lib4x options if tree view to be applied
                    if (view && view.element.grid('option')?.lib4x?.applyTreeView)
                    {
                        if (!view.element.data('lib4x-applytreeview-initialized'))
                        {
                            view.element.closest('.a-PopupLOV-dialog').addClass('lib4x-has-treegrid');
                            // disabled sorting; the sorting is part of the hierarchical query
                            view.element.grid('option', 'columnSort', false);
                            let options = view.element.grid('option').lib4x.treeViewOptions || {};
                            if (options.showTooltip)
                            {
                                view.element.grid('option', 'tooltip', 
                                    {
                                        content: function(callback, model, recordMeta, colMeta, columnDef) {
                                            let text;
                                            if ((recordMeta) && (columnDef?.property == options.treeColumn))
                                            {
                                                text = model.getValue(recordMeta.record, options.treeColumn);
                                            }
                                            return text;
                                        },
                                        position: { my: "right bottom", at: "right-15 bottom-40" }
                                    }
                                );
                            }
                            // prevent parents to be selected on click in case option leafOnlySelection is true
                            view.element.on('click.lib4x', function(jQueryEvent, data){
                                let options = view.element.grid('option').lib4x.treeViewOptions || {};
                                if (options.leafOnlySelection === true)
                                {
                                    let row$ = $(jQueryEvent.target).closest('.a-GV-row');
                                    if (row$.length && (row$.hasClass('lib4x-treegrid')) && (!row$.hasClass('lib4x-treegrid-is-leaf')))
                                    {
                                        jQueryEvent.stopImmediatePropagation();
                                        // on click, set the selected record, enabling accessibility features
                                        view.setSelectedRecords([view.element.grid('getModel').getRecord(row$.attr('data-id'))], true, false);
                                    }
                                }
                            });
                            // have the click.lib4x event handler prioritized
                            util.prioritizeEventHandler(view.element[0], 'click');
                            // upon a new page, including first page, apply the tree view
                            view.element.on('gridpagechange.lib4x', function(jQueryEvent, data) { 
                                let options = view.element.grid('option').lib4x.treeViewOptions || {};
                                treegridModule.applyTree(view.element, options);
                            });
                            // upon double click, toggle the row and prevent std APEX behavior 
                            view.element.on('gridactivatecell.lib4x', function(jQueryEvent, data) { 
                                let options = view.element.grid('option').lib4x.treeViewOptions || {};
                                if (options.leafOnlySelection === true)
                                {
                                    if (data.row$.length && (!data.row$.hasClass('lib4x-treegrid-is-leaf')))
                                    {
                                        // get rid of any selected record so effectively the 
                                        // selection and exit dialog gets cancelled
                                        let selectedRecords = view.getSelectedRecords();
                                        if (selectedRecords.length > 0)
                                        {
                                            view.setSelectedRecords([], false, true);
                                        }
                                        treegridModule.toggle(data.row$);
                                        view.element.grid('resize');
                                    }
                                }                                  
                            });    
                            // add Expand/Collapse All button
                            $(jQueryEvent.target).find('.a-PopupLOV-searchBar').append('<button type="button" class="a-Button lib4x-toggle-all" title="Expand/Collapse" aria-label="Expand/Collapse"><span class="fa fa-expand-collapse" aria-hidden="true"></span></button>');                                                    
                            $(jQueryEvent.target).find('.lib4x-toggle-all').on('click', function(){
                                treegridModule.toggleAll(view.element);
                            });
                            view.element.data('lib4x-applytreeview-initialized', true);
                        }
                    }
                }
            });    
        });    
    })();

    //==ig module
    let igModule = (function() 
    {    
        $(function(){
            apex.gPageContext$.on("interactivegridviewmodelcreate", function(jQueryEvent, data){  
                let igConfig = $(jQueryEvent.target).interactiveGrid('option').config;
                if (igConfig.defaultGridViewOptions?.lib4x?.applyTreeView)
                {
                    let gridView = $(jQueryEvent.target).interactiveGrid('getViews').grid; 
                    if (gridView)
                    {
                        let gridView$ = gridView.view$;
                        if (!gridView$.data('lib4x-applytreeview-initialized'))
                        {
                            gridView$.on('gridpagechange.lib4x', function(jQueryEvent, data) { 
                                let options = gridView$.grid('option').lib4x.treeViewOptions || {};
                                treegridModule.applyTree(gridView$, options);
                            });
                            gridView$.data('lib4x-applytreeview-initialized', true);
                        }
                    }
                }
            });
        });        
    })();        

    let util = {
        // make sure lib4x event handlers are triggered before apex event handlers
        prioritizeEventHandler: function(element, eventName)
        {
            // http://www.robeesworld.com/blog/67/changing-the-order-of-the-jquery-event-queue
            let eventList = $._data(element, "events");
            // to be sure, check if the last handler has lib4x namespace
            if (eventList)
            {
                if (eventList[eventName].length > 1 && (eventList[eventName][eventList[eventName].length-1].namespace === 'lib4x'))
                {
                    // take out last one and put as first one
                    eventList[eventName].unshift(eventList[eventName].pop());
                }  
            }      
        }
    };

    //==treegrid module
    // this module is based on the TreeGrid plugin for jQuery
    // by Maksym Pomazan
    // https://github.com/maxazan/jquery-treegrid
    // the original code is set up as a jQuery plugin extending jQuery's prototype ($.fn)
    // as APEX actively avoids these constructs, the below code is adjusted as wel, accepting the node 
    // for each function and not returning the node
    let treegridModule = (function() 
    {
        let treegrid = {
            /**
             * Initialize node(s)
             */
            initNode: function(elements$, treeContainer$, nodeDepth) {
                elements$.each(function() {
                    let el$ = $(this);
                    treegrid.setTreeContainer(el$, treeContainer$);
                    treegrid.initEvents(el$);
                    treegrid.initExpander(el$);
                    treegrid.initIndent(el$, nodeDepth);
                    treegrid.initState(el$);
                    treegrid.initToggleEvent(el$);
                    treegrid.initSettingsEvents(el$);                    
                });
            },
            /**
             * Init Node Toggle Event
             */            
            initToggleEvent: function(el$) {
                el$.on("toggle", function() {
                    let this$ = $(this);
                    treegrid.render(this$);
                });
            },
            /**
             * Initialize node events
             */
            initEvents: function(el$) {
                //Default behavior on collapse
                el$.on("collapse", function() {
                    let this$ = $(this);
                    this$.removeClass('lib4x-treegrid-expanded');
                    this$.addClass('lib4x-treegrid-collapsed');
                    this$.attr('aria-expanded', false);
                });
                //Default behavior on expand
                el$.on("expand", function() {
                    let this$ = $(this);
                    this$.removeClass('lib4x-treegrid-collapsed');
                    this$.addClass('lib4x-treegrid-expanded');
                    this$.attr('aria-expanded', true);
                });
            },
            /**
             * Initialize events from settings
             */
            initSettingsEvents: function(el$) {
                // on toggle
                el$.on("toggle", function() {
                    let this$ = $(this);
                    // any future code
                });
                // on collapse
                el$.on("collapse", function() {
                    let this$ = $(this);
                    // any future code
                });
                // on expand
                el$.on("expand", function() {
                    let this$ = $(this);
                    // any future code
                });
            },
            /**
             * Initialize expander for node
             */
            initExpander: function(el$) {
                let treeColumn = treegrid.getSetting(el$, 'treeColumn');
                let cell = el$.find('td').get(treeColumn);
                let tpl = treegrid.getSetting(el$, 'expanderTemplate');
                let expander = treegrid.getExpander(el$);
                if (expander) {
                    expander.remove();
                }
                $(tpl).prependTo(cell).click(function(jQueryEvent) {
                    jQueryEvent.stopImmediatePropagation();               
                    treegrid.toggle(el$.closest('tr'));
                    el$.closest('.a-PopupLOV-results').grid('resize');
                });
            },
            /**
             * Get Expander
             */            
            getExpander: function(el$) {
                return el$.find('.lib4x-treegrid-expander');
            },
            /**
             * Initialize indent for node
             */
            initIndent: function(el$, depthLevel) {
                let expander$ = treegrid.getExpander(el$);
                expander$.css({"margin-left":depthLevel*expander$.width()}); 
            },
            /**
             * Initialise state of node
             */
            initState: function(el$) {
                if (el$.hasClass('lib4x-treegrid-expanded')) {
                    treegrid.expand(el$);
                } else {
                    treegrid.collapse(el$);
                }
            },
            /**
             * Method return setting by name
             */
            getSetting: function(el$, name) {
                let treeContainer$ = treegrid.getTreeContainer(el$);
                return treeContainer$.data('settings')[name];
            },
            /**
             * Add new settings
             */
            setSettings: function(el$, settings) {
                treegrid.getTreeContainer(el$).data('settings', settings);
            },
            /**
             * Return tree container
             */
            getTreeContainer: function(el$) {
                return el$.data('treegrid');
            },
            /**
             * Set tree container
             */
            setTreeContainer: function(el$, container) {
                return el$.data('treegrid', container);
            },
            /**
             * Method return all root nodes of tree.
             */
            getRootNodes: function(table$) {
                let treeContainer$ = treegrid.getTreeContainer(table$);
                let result = $.grep(treeContainer$.find('tr'), function(element) {
                    let classNames = $(element).attr('class');
                    let templateClass = /lib4x-treegrid-([A-Za-z0-9_-]+)/;
                    let templateParentClass = /lib4x-treegrid-parent-([A-Za-z0-9_-]+)/;
                    return templateClass.test(classNames) && !templateParentClass.test(classNames);
                });
                return $(result);
            },
            /**
             * Method return all nodes of tree.
             */
            getAllNodes: function() {
                let treeContainer$ = treegrid.getTreeContainer(el$);
                let result = $.grep(treeContainer$.find('tr'), function(element) {
                    let classNames = $(element).attr('class');
                    let templateClass = /lib4x-treegrid-([A-Za-z0-9_-]+)/;
                    return templateClass.test(classNames);
                });
                return $(result);
            },
            /**
             * Method return true if element is Node
             */
            isNode: function(el$) {
                return treegrid.getNodeId(el$) !== null;
            },
            /**
             * Method return id of node
             */
            getNodeId: function(el$) {
                let template = /lib4x-treegrid-([A-Za-z0-9_-]+)/;
                if (template.test(el$.attr('class'))) {
                    return template.exec(el$.attr('class'))[1];
                }
                return null;                
            },
            /**
             * Get Node by Id
             */            
            getNodeById: function(id, treeContainer$) {
                let templateClass = "lib4x-treegrid-" + id;
                return treeContainer$.find('tr.' + templateClass);
            },            
            /**
             * Method return parent id of node or null if root node
             */
            getParentNodeId: function(el$) {
                let template = /lib4x-treegrid-parent-([A-Za-z0-9_-]+)/;
                let templateTest = template.test(el$.attr('class'));
                if (templateTest && $('.lib4x-treegrid-' + template.exec(el$.attr('class'))[1]).length) {
                    return template.exec(el$.attr('class'))[1];
                }
                return null;
            },
            /**
             * Method return parent node or null if root node
             */
            getParentNode: function(el$) {
                let parentNodeId = treegrid.getParentNodeId(el$);
                if (parentNodeId === null) {
                    return null;
                } else {
                    let treeContainer$ = treegrid.getTreeContainer(el$);
                    return treegrid.getNodeById(parentNodeId, treeContainer$);
                }
            },
            /**
             * Method return array of child nodes or null if node is leaf
             */
            getChildNodes: function(el$) {
                let id = treegrid.getNodeId(el$);
                let templateClass = "lib4x-treegrid-parent-" + id;
                let treeContainer$ = treegrid.getTreeContainer(el$);
                return treeContainer$.find('tr.' + templateClass);
            },
            /**
             * Method return depth of tree.
             */
            getDepth: function(el$) {
                let parentNode$ = treegrid.getParentNode(el$);
                if (parentNode$ === null) {
                    return 0;
                }
                return treegrid.getDepth(parentNode$) + 1;
            },
            /**
             * Method return true if node is root
             */
            isRoot: function(el$) {
                return treegrid.getDepth(el$) === 0;
            },
            /**
             * Method return true if node was marked as a leaf node
             */
            isLeaf: function(el$) {
                return el$.hasClass('lib4x-treegrid-is-leaf');
            },
            /**
             * Return true if node expanded
             */
            isExpanded: function(el$) {
                return el$.hasClass('lib4x-treegrid-expanded');
            },
            /**
             * Return true if node collapsed
             */
            isCollapsed: function(el$) {
                return el$.hasClass('lib4x-treegrid-collapsed');
            },
            /**
             * Return true if at least one of parent node is collapsed
             */
            isOneOfParentsCollapsed: function(el$) {
                if (treegrid.isRoot(el$)) {
                    return false;
                } else {
                    let parentNode$ = treegrid.getParentNode(el$);
                    if (treegrid.isCollapsed(parentNode$)) {
                        return true;
                    } else {
                        return treegrid.isOneOfParentsCollapsed(parentNode$);
                    }
                }
            },
            /**
             * Expand node
             */
            expand: function(el$) {
                if (!treegrid.isLeaf(el$) && !treegrid.isExpanded(el$)) {
                    el$.trigger("expand");
                    el$.trigger("toggle"); 
                }
            },
            /**
             * Expand all nodes
             */
            expandAll: function(table$) {
                treegrid.expandRecursive(treegrid.getRootNodes(table$));
            },
            /**
             * Expand each node and all child nodes
             */
            expandRecursive: function(elements$) {
                elements$.each(function() {
                    let this$ = $(this);
                    treegrid.expand(this$);
                    if (!treegrid.isLeaf(this$)) {
                        treegrid.expandRecursive(treegrid.getChildNodes(this$));
                    }
                });
            },
            /**
             * Collapse node
             */
            collapse: function(elements$) {
                elements$.each(function() {
                    let this$ = $(this);
                    if (!treegrid.isLeaf(this$) && !treegrid.isCollapsed(this$)) {
                        this$.trigger("collapse");
                        this$.trigger("toggle");
                    }
                });
            },
            /**
             * Collapse all nodes
             */
            collapseAll: function(table$) {
                treegrid.collapseRecursive(treegrid.getRootNodes(table$));
            },
            /**
             * Collapse each node and all child nodes
             */
            collapseRecursive: function(elements$) {
                elements$.each(function() {
                    let this$ = $(this);
                    treegrid.collapse(this$);
                    if (!treegrid.isLeaf(this$)) {
                        treegrid.collapseRecursive(treegrid.getChildNodes(this$));
                    }
                });
            },
            /**
             * Expand if collapsed, Collapse if expanded
             */
            toggle: function(el$) {
                if (treegrid.isExpanded(el$)) {
                    treegrid.collapse(el$);
                } else {
                    treegrid.expand(el$);
                }
            },
            /**
             * ToggleAll: either collapse or expand all
             */            
            toggleAll: function(table$) {
                if (table$.find('.lib4x-treegrid-expanded').length)
                {
                    treegrid.collapseAll(table$);
                }
                else
                {
                    treegrid.expandAll(table$);
                }
            },            
            /**
             * Rendering node
             */
            render: function(elements$) {
                if (elements$ && elements$.length)
                {
                    let parentNodesDisabled = treegrid.getSetting(elements$.first(), 'parentNodesDisabled');
                    elements$.each(function() {
                        let this$ = $(this);

                        //if parent is collapsed, hide the row
                        if (treegrid.isOneOfParentsCollapsed(this$)) {
                            this$.hide();
                        } else {
                            this$.show();
                        }
                        if (!treegrid.isLeaf(this$)) {
                            treegrid.renderExpander(this$);
                            if (parentNodesDisabled)
                            {
                                this$.attr('aria-disabled', true);
                            }
                            treegrid.render(treegrid.getChildNodes(this$));
                        }
                        else if (parentNodesDisabled)
                        {
                            this$.removeAttr('aria-disabled');
                        }
                    });
                }
            },
            /**
             * Rendering expander depends on node state
             */
            renderExpander: function(elements$) {
                elements$.each(function() {
                    let this$ = $(this);
                    let expander = treegrid.getExpander(this$);
                    if (expander) {
                        let expanderCollapsedClass = treegrid.getSetting(this$, 'expanderCollapsedClass');
                        let expanderExpandedClass = treegrid.getSetting(this$, 'expanderExpandedClass');
                        if (!treegrid.isCollapsed(this$)) {
                            expander.removeClass(expanderCollapsedClass);
                            expander.addClass(expanderExpandedClass);
                        } else {
                            expander.removeClass(expanderExpandedClass);
                            expander.addClass(expanderCollapsedClass);
                        }
                    } else {
                        treegrid.initExpander(this$);
                        treegrid.renderExpander(this$);
                    }
                });
            }
        };
        /**
         *  TreeGrid defaults
         */
        function getTreegridDefaults() 
        {
            return {
                initialState: 'collapsed',
                expanderTemplate: '<span class="lib4x-treegrid-expander"></span>',
                expanderExpandedClass: 'lib4x-treegrid-expander-expanded',
                expanderCollapsedClass: 'lib4x-treegrid-expander-collapsed',
                treeColumn: 0,
                parentNodesDisabled: false
            };
        };        

        /**
         * Apply the tree view to the given grid element
        *  Starting point for below function taken from the APEX Interactive Grid Treegrid Enhancement APEX Dynamic Action Plug-in
        *  by Richárd Báldogi 
        *  https://github.com/baldogiRichard/apex-treegrid-enhancement-for-ig
         */
        function applyTree(gridView$, options)
        {            
            options.tableSelector = ".a-GV-table";
            options.rowSelector = ".a-GV-row";
            options.initialState = options.initialState || 'collapsed';
            let model = gridView$.grid('getModel');
            if (!model.getOption('identityField'))
            {
                apex.debug.warn('LIB4X - ApplyTreeView: primary key column not set. Model: ' + model.name);
            }
            let columns = gridView$.grid("getColumns").filter(column => !column.hidden);
            // get the index of the column which should be turned into a tree
            let treeColumnIdx = columns.findIndex(column => column.property === options.treeColumn);
            if (treeColumnIdx != -1)
            {
                let treegridSettings = getTreegridDefaults();
                treegridSettings.treeColumn = treeColumnIdx;
                treegridSettings.initialState = options.initialState;
                treegridSettings.parentNodesDisabled = (options.leafOnlySelection === true);
                let expandToLevel = options.initialExpandToLevel || 99;
                let table$ = gridView$.find(options.tableSelector).last();
                if (table$.length)
                {
                    table$.addClass('lib4x-treegrid');
                    treegrid.setTreeContainer(table$, table$);
                    treegrid.setSettings(table$, treegridSettings);
                    // adding treegrid CSS classes to the rows
                    model.forEach(function(record, index, recId) {
                        let recParentId = model.getValue(record, options.parentIdColumn);
                        let isLeaf = model.getValue(record, options.isLeafColumn);
                        let nodeDepth    = model.getValue(record, options.levelColumn) - 1;
                        let row$ = table$.find(options.rowSelector + "[data-id='" + recId + "']");            
                        if (row$.length && !row$.hasClass('lib4x-treegrid')) {
                            row$.addClass('lib4x-treegrid');
                            row$.addClass('lib4x-treegrid-' + recId);
                            if(recParentId && table$.find(".lib4x-treegrid-" + recParentId).length > 0) {
                                row$.addClass('lib4x-treegrid-parent-' + recParentId);
                            };
                            if ((isLeaf == '1') || (isLeaf == 'Y'))
                            {
                                row$.addClass('lib4x-treegrid-is-leaf');
                            }
                            else
                            {
                                let initialState = ((nodeDepth+1) < expandToLevel ? options.initialState: 'collapsed');
                                row$.addClass('lib4x-treegrid-' + initialState);
                                row$.attr('aria-expanded', initialState == 'expanded');
                            }
                            // initialize row
                            treegrid.initNode(row$, table$, nodeDepth);
                        }
                    });
                    let rootNodes$ = treegrid.getRootNodes(table$);
                    treegrid.render(rootNodes$);  
                } 
            }
        }

        function expandAll(gridView$)
        {
            let table$ = gridView$.find('table.lib4x-treegrid');
            if (table$.length)
            {
                treegrid.expandAll(table$);
                gridView$.grid('resize');
            }
        }

        function collapseAll(gridView$)
        {
            let table$ = gridView$.find('table.lib4x-treegrid');
            if (table$.length)
            {
                treegrid.collapseAll(table$);
            }
        }    
        
        function toggleAll(gridView$)
        {
            let table$ = gridView$.find('table.lib4x-treegrid');
            if (table$.length)
            {
                treegrid.toggleAll(table$);
                gridView$.grid('resize');
            }
        }         

        return{
            applyTree: applyTree,
            toggle: treegrid.toggle,
            expandAll: expandAll,
            collapseAll: collapseAll,
            toggleAll: toggleAll
        };
    })();           
    
    // called by the DA as to init the plugin
    let init = function()
    {
        // let daThis = this;
        // currently no init action required
    }

    return{
        _init: init,
        expandAll: treegridModule.expandAll,
        collapseAll: treegridModule.collapseAll,
        toggleAll: treegridModule.toggleAll
    }    
})(apex.jQuery);
