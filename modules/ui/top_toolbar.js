
import {
    select as d3_select
} from 'd3-selection';
import { t } from '../util/locale';
import { modeBrowse } from '../modes/browse';
import _debounce from 'lodash-es/debounce';
import { uiToolAddFavorite, uiToolAddRecent, uiToolNotes, uiToolOperation, uiToolSave, uiToolAddFeature, uiToolSidebarToggle, uiToolUndoRedo } from './tools';
import { uiToolSimpleButton } from './tools/simple_button';

export function uiTopToolbar(context) {

    var sidebarToggle = uiToolSidebarToggle(context),
        addFeature = uiToolAddFeature(context),
        addFavorite = uiToolAddFavorite(context),
        addRecent = uiToolAddRecent(context),
        notes = uiToolNotes(context),
        undoRedo = uiToolUndoRedo(context),
        save = uiToolSave(context),
        deselect = uiToolSimpleButton('deselect', t('toolbar.deselect.title'), 'iD-icon-close', function() {
            context.enter(modeBrowse(context));
        }, null, 'Esc'),
        cancelDrawing = uiToolSimpleButton('cancel', t('confirm.cancel'), 'iD-icon-close', function() {
            context.enter(modeBrowse(context));
        }, null, 'Esc', 'wide'),
        finishDrawing = uiToolSimpleButton('finish', t('toolbar.finish'), 'iD-icon-apply', function() {
            var mode = context.mode();
            if (mode.finish) mode.finish();
        }, null, 'Esc', 'wide');

    var supportedOperationIDs = ['circularize', 'downgrade', 'delete', 'disconnect', 'merge', 'orthogonalize', 'split', 'straighten'];

    var operationToolsByID = {};

    function notesEnabled() {
        var noteLayer = context.layers().layer('notes');
        return noteLayer && noteLayer.enabled();
    }

    function operationTool(operation) {
        if (!operationToolsByID[operation.id]) {
            // cache the tools
            operationToolsByID[operation.id] = uiToolOperation(context);
        }
        var tool = operationToolsByID[operation.id];
        tool.setOperation(operation);
        return tool;
    }

    function toolsToShow() {

        var tools = [];

        var mode = context.mode();
        if (!mode) return tools;

        if (mode.id === 'select' &&
            !mode.newFeature() &&
            mode.selectedIDs().every(function(id) { return context.graph().hasEntity(id); })) {

            tools.push(sidebarToggle);
            tools.push('spacer-half');

            tools.push(deselect);
            tools.push('spacer');

            var operationTools = [];
            var operations = mode.operations().filter(function(operation) {
                return supportedOperationIDs.indexOf(operation.id) !== -1;
            });
            var deleteTool;
            for (var i in operations) {
                var operation = operations[i];
                var tool = operationTool(operation);
                if (operation.id !== 'delete' && operation.id !== 'downgrade') {
                    operationTools.push(tool);
                } else {
                    deleteTool = tool;
                }
            }
            if (operationTools.length > 0) {
                tools = tools.concat(operationTools);
            }
            if (deleteTool) {
                // keep the delete button apart from the others
                tools.push('spacer-half');
                tools.push(deleteTool);
            }
            tools.push('spacer');

            tools = tools.concat([undoRedo, save]);

        } else if (mode.id === 'add-point' || mode.id === 'add-line' || mode.id === 'add-area') {
            tools.push(sidebarToggle);
            tools.push('spacer');

            tools.push(cancelDrawing);
        } else if (mode.id === 'draw-line' || mode.id === 'draw-area') {
            tools.push(sidebarToggle);
            tools.push('spacer');

            tools.push(undoRedo);

            var way = context.hasEntity(mode.wayID);
            if (way && new Set(way.nodes).size - 1 >= (way.isArea() ? 3 : 2)) {
                tools.push(finishDrawing);
            } else {
                tools.push(cancelDrawing);
            }
        } else {
            tools.push(sidebarToggle);
            tools.push('spacer');

            tools.push(addFeature);

            if (context.presets().getFavorites().length > 0) {
                tools.push(addFavorite);
            }

            if (addRecent.shouldShow()) {
                tools.push(addRecent);
            }

            tools.push('spacer');

            if (notesEnabled()) {
                tools = tools.concat([notes, 'spacer']);
            }
            tools = tools.concat([undoRedo, save]);
        }

        return tools;
    }

    function topToolbar(bar) {

        var debouncedUpdate = _debounce(update, 250, { leading: true, trailing: true });
        context.history()
            .on('change.topToolbar', debouncedUpdate);
        context.layers()
            .on('change.topToolbar', debouncedUpdate);
        context.map()
            .on('move.topToolbar', debouncedUpdate)
            .on('drawn.topToolbar', debouncedUpdate);

        context.on('enter.topToolbar', update);

        context.presets()
            .on('favoritePreset.topToolbar', update)
            .on('recentsChange.topToolbar', update);


        update();

        function update() {

            var tools = toolsToShow();

            var toolbarItems = bar.selectAll('.toolbar-item')
                .data(tools, function(d) {
                    return d.id || d;
                });

            toolbarItems.exit()
                .each(function(d) {
                    if (d.uninstall) {
                        d.uninstall();
                    }
                })
                .remove();

            var itemsEnter = toolbarItems
                .enter()
                .append('div')
                .attr('class', function(d) {
                    var classes = 'toolbar-item ' + (d.id || d).replace('_', '-');
                    if (d.klass) classes += ' ' + d.klass;
                    return classes;
                });

            var actionableItems = itemsEnter.filter(function(d) { return typeof d !== 'string'; });

            actionableItems
                .append('div')
                .attr('class', 'item-content')
                .each(function(d) {
                    d3_select(this).call(d.render, bar);
                });

            actionableItems
                .append('div')
                .attr('class', 'item-label')
                .text(function(d) {
                    return d.label;
                });

            toolbarItems.merge(itemsEnter)
                .each(function(d){
                    if (d.update) d.update();
                });
        }

    }

    return topToolbar;
}
