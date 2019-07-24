/*! Icinga Web 2 | (c) 2019 Icinga GmbH | GPLv2+ */

;(function(Icinga, $) {

    'use strict';

    Icinga.Behaviors = Icinga.Behaviors || {};

    /**
     * Behavior for collapsible containers.
     *
     * @param  icinga  Icinga  The current Icinga Object
     */
    var Collapsible = function(icinga) {
        Icinga.EventListener.call(this, icinga);

        this.on('layout-change', this.onLayoutChange, this);
        this.on('rendered', '#layout', this.onRendered, this);
        this.on('click', '.collapsible + .collapsible-control, .collapsible > .collapsible-control',
            this.onControlClicked, this);

        this.icinga = icinga;
        this.defaultVisibleRows = 2;
        this.defaultVisibleHeight = 36;

        this.state = new Icinga.Storage.StorageAwareMap.withStorage(
            Icinga.Storage.BehaviorStorage('collapsible'),
            'expanded'
        )
            .on('add', this.onExpand, this)
            .on('delete', this.onCollapse, this);
    };

    Collapsible.prototype = new Icinga.EventListener();

    /**
     * Initializes all collapsibles. Triggered on rendering of a container.
     *
     * @param event  Event  The `onRender` event triggered by the rendered container
     */
    Collapsible.prototype.onRendered = function(event) {
        var _this = event.data.self;

        $('.collapsible:not(.can-collapse)', event.target).each(function() {
            var $collapsible = $(this);

            // Assumes that any newly rendered elements are expanded
            if (_this.canCollapse($collapsible)) {
                var toggleElement = $collapsible.data('toggleElement');
                if (!! toggleElement) {
                    var $toggle = $collapsible.children(toggleElement).first();
                    if (! $toggle.length) {
                        _this.icinga.logger.error(
                            '[Collapsible] Control `' + toggleElement + '` not found in .collapsible', $collapsible);
                    } else if (! $toggle.is('.collapsible-control')) {
                        $toggle.addClass('collapsible-control');
                    }
                } else {
                    $collapsible.after($('#collapsible-control-ghost').clone().removeAttr('id'));
                }

                $collapsible.addClass('can-collapse');

                if (! _this.state.has(_this.icinga.utils.getCSSPath($collapsible))) {
                    _this.collapse($collapsible);
                }
            }
        });
    };

    /**
     * Updates all collapsibles.
     *
     * @param event  Event  The `layout-change` event triggered by window resizing or column changes
     */
    Collapsible.prototype.onLayoutChange = function(event) {
        var _this = event.data.self;

        $('.collapsible').each(function() {
            var $collapsible = $(this);
            var collapsiblePath = _this.icinga.utils.getCSSPath($collapsible);

            if ($collapsible.is('.can-collapse')) {
                if (! _this.canCollapse($collapsible)) {
                    $collapsible.next('.collapsible-control').remove();
                    $collapsible.removeClass('can-collapse');
                    _this.expand($collapsible);
                }
            } else if (_this.canCollapse($collapsible)) {
                // It's expanded but shouldn't
                $collapsible.after($('#collapsible-control-ghost').clone().removeAttr('id'));
                $collapsible.addClass('can-collapse');

                if (! _this.state.has(collapsiblePath)) {
                    _this.collapse($collapsible);
                }
            }
        });
    };

    /**
     * A collapsible got expanded in another window, try to apply this here as well
     *
     * @param   {string}    collapsiblePath
     */
    Collapsible.prototype.onExpand = function(collapsiblePath) {
        var $collapsible = $(collapsiblePath);

        if ($collapsible.length && $collapsible.is('.can-collapse')) {
            this.expand($collapsible);
        }
    };

    /**
     * A collapsible got collapsed in another window, try to apply this here as well
     *
     * @param   {string}    collapsiblePath
     */
    Collapsible.prototype.onCollapse = function(collapsiblePath) {
        var $collapsible = $(collapsiblePath);

        if ($collapsible.length && this.canCollapse($collapsible)) {
            this.collapse($collapsible);
        }
    };

    /**
     * Event handler for toggling collapsibles. Switches the collapsed state of the respective container.
     *
     * @param event  Event  The `onClick` event triggered by the clicked collapsible-control element
     */
    Collapsible.prototype.onControlClicked = function(event) {
        var _this = event.data.self;
        var $target = $(event.currentTarget);

        var $collapsible = $target.prev('.collapsible');
        if (! $collapsible.length) {
            $collapsible = $target.parent('.collapsible');
        }

        if (! $collapsible.length) {
            _this.icinga.logger.error('[Collapsible] Collapsible control has no associated .collapsible: ', $target);
        } else {
            var collapsiblePath = _this.icinga.utils.getCSSPath($collapsible);
            if (_this.state.has(collapsiblePath)) {
                _this.state.delete(collapsiblePath);
                _this.collapse($collapsible);
            } else {
                _this.state.set(collapsiblePath);
                _this.expand($collapsible);
            }
        }
    };

    /**
     * Return an appropriate row element selector
     *
     * @param $collapsible jQuery  The given collapsible container element
     *
     * @returns {string}
     */
    Collapsible.prototype.getRowSelector = function($collapsible) {
        if (!! $collapsible.data('visibleHeight')) {
            return '';
        }

        if ($collapsible.is('table')) {
            return '> tbody > tr';
        } else if ($collapsible.is('ul, ol')) {
            return '> li';
        }

        return '';
    };

    /**
     * Check whether the given collapsible needs to collapse
     *
     * @param $collapsible jQuery  The given collapsible container element
     *
     * @returns {boolean}
     */
    Collapsible.prototype.canCollapse = function($collapsible) {
        var rowSelector = this.getRowSelector($collapsible);
        if (!! rowSelector) {
            var visibleRows = $collapsible.data('visibleRows') || this.defaultVisibleRows;

            return $(rowSelector, $collapsible).length > visibleRows * 2;
        } else {
            var actualHeight = $collapsible[0].scrollHeight;
            var maxHeight = $collapsible.data('visibleHeight') || this.defaultVisibleHeight;

            return actualHeight >= maxHeight * 2;
        }
    };

    /**
     * Collapse the given collapsible
     *
     * @param   $collapsible    jQuery      The given collapsible container element
     */
    Collapsible.prototype.collapse = function($collapsible) {
        $collapsible.addClass('collapsed');

        var rowSelector = this.getRowSelector($collapsible);
        if (!! rowSelector) {
            var $rows = $(rowSelector, $collapsible).slice(0, $collapsible.data('visibleRows') || this.defaultVisibleRows);

            var totalHeight = $rows.offset().top - $collapsible.offset().top;
            $rows.outerHeight(function(_, height) {
                totalHeight += height;
            });

            $collapsible.css({display: 'block', height: totalHeight});
        } else {
            $collapsible.css({display: 'block', height: $collapsible.data('visibleHeight') || this.defaultVisibleHeight});
        }
    };

    /**
     * Expand the given collapsible
     *
     * @param   $collapsible    jQuery      The given collapsible container element
     */
    Collapsible.prototype.expand = function($collapsible) {
        $collapsible.removeClass('collapsed');
        $collapsible.css({display: '', height: ''});
    };

    Icinga.Behaviors.Collapsible = Collapsible;

})(Icinga, jQuery);
