/*******************************************************************************
 * Copyright 2012-2015 CNES - CENTRE NATIONAL d'ETUDES SPATIALES
 *
 * This file is part of MIZAR.
 *
 * MIZAR is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MIZAR is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MIZAR. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
/*global define: false */

define(["require", "jquery", "underscore-min","../utils/UtilsCore",
        "./PickingManager", "./ImageManager", "./ImageProcessing", "./SimpleProgressBar", "service/Samp", "./dialog/ErrorDialog",
        "text!templates/imageViewer.html", "text!templates/imageViewerLayerItem.html", "text!templates/imageViewerImageItem.html", "jquery.ui"],
    function (require, $, _, UtilsCore,
              PickingManager, ImageManager, ImageProcessing, SimpleProgressBar, Samp, ErrorDialog,
              imageViewerHTML, imageViewerLayerItemHTMLTemplate, imageViewerImageItemHTMLTemplate) {

        var mizarWidgetAPI;
        var navigation;

// jQuery selector
        var $imageViewer;

        var layers = [];
        var featuresWithImages = [];

// Template generating the div representing layer which contains loaded images
        var imageViewerLayerItemTemplate = _.template(imageViewerLayerItemHTMLTemplate);
// Template generating the li representing image
        var imageViewerImageItemTemplate = _.template(imageViewerImageItemHTMLTemplate);

        /**************************************************************************************************************/

        /**
         *    Disable image toolbar inputs
         */
        function disableImageUI(layer) {
            $imageViewer.find('.imageLayers div[id="imageLayer_' + layer.id + '"] ul')
                .find('button, input').each(function () {
                    $(this).attr('disabled', 'disabled').button('refresh');
                });
        }

        /**************************************************************************************************************/

        /**
         *    Enable image toolbar inputs
         */
        function enableImageUI(layer) {
            $imageViewer.find('.imageLayers div[id="imageLayer_' + layer.id + '"] ul')
                .find('button, input').each(function () {
                    // Don't enable image processing for not fits files
                    if (!$(this).hasClass('fitsUnavailable')) {
                        $(this).removeAttr('disabled').button('refresh');
                    }
                });
        }

        /**************************************************************************************************************/

        /**
         *    Handler to manage BaseLayer "visibility:change" event
         */
        function onVisibilityChange(layer) {
            var $layer = $imageViewer.find('.imageLayers div[id="imageLayer_' + layer.id + '"]');
            var $layerVisibility = $layer.find('#layerVisibility_' + layer.id);
            $layerVisibility.button("option", {
                icons: {
                    primary: layer.isVisible() ? "ui-icon-check" : ""
                }
            }).button('refresh');

            // TODO: still tiny bug with label "ui-state-active" class toggling

            if (layer.isVisible()) {
                enableImageUI(layer);
            }
            else {
                disableImageUI(layer);
            }
        }

        /**************************************************************************************************************/

        /**
         *    Create layer view
         *    This view will contain all the loaded images for the given layer
         */
        function createLayerView(layer) {
            var imageViewerLayerItemContent = imageViewerLayerItemTemplate({id: layer.id, name: layer.name});
            var $layer = $(imageViewerLayerItemContent)
                .appendTo($imageViewer.find('.imageLayers'));

            // Slide loaded images for current layer onclick
            $layer.find('label.layerName').click(function () {
                $("#imageLayer_" + layer.id + " > ul").slideToggle();
            });

            // Stylize layer visibility checkbox
            var $layerVisibility = $layer.find('#layerVisibility_' + layer.id);
            // Layer visibility management
            $layerVisibility.button({
                text: false,
                icons: {
                    primary: "ui-icon-check"
                }
            }).click(function () {
                var isChecked = !($layerVisibility.button('option', 'icons').primary === "ui-icon-check");
                layer.setVisible(isChecked);
            });

            if (layers.length === 0) {
                $imageViewer.find('#loadedImages p').fadeOut(function () {
                    $layer.fadeIn();
                });
            }
            else {
                $layer.fadeIn();
            }

            layers.push(layer);
            mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_VISIBILITY_CHANGED, onVisibilityChange);

            return $layer;
        }

        /**************************************************************************************************************/

        /**
         *    Show image viewer
         */
        function showImageViewer() {
            $imageViewer.find('#loadedImages').css({boxShadow: "0px 0px 8px 1px rgba(255, 158, 82, 0.92)"});
            $imageViewer.find('#imageViewInvoker').css('background-position', '0px -20px')
                .parent().animate({right: '0px'}, 300);
        }

        /**************************************************************************************************************/

        /**
         *    Hide image viewer
         */
        function hideImageViewer() {
            $imageViewer.find('#loadedImages').css({boxShadow: "none"});
            $imageViewer.find('#imageViewInvoker').css('background-position', '0px 0px')
                .parent().animate({right: '-254px'}, 300);
        }

        /**************************************************************************************************************/

        return {

            /**
             *    Init image viewer
             */
            init: function (m) {
                mizarWidgetAPI = m;
                mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.IMAGE_ADDED, this.addView);
                mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.IMAGE_REMOVED, this.removeView);
                mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.IMAGE_DOWNLOADED, this.addProgressBar);
                mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_REMOVED, this.removeLayer);
                navigation = mizarWidgetAPI.getNavigation();

                $imageViewer = $(imageViewerHTML).appendTo('#imageViewerDiv');

                // Show/hide image viewer
                $imageViewer.find('#imageViewInvoker').click(function () {
                    if (parseFloat($(this).parent().css('right')) < 0) {
                        showImageViewer();
                    }
                    else {
                        hideImageViewer();
                    }
                });
                // Create accordion
                $imageViewer.find("#loadedImages").accordion({
                    heightStyle: "content",
                    active: 0,
                    collapsible: true
                }).show();
            },

            /**
             *    Remove UI and unregister all the events
             */
            remove: function () {
                for (var i = 0; i < layer.length; i++) {
                    layer.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_VISIBILITY_CHANGED, onVisibilityChange);
                }

                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.IMAGE_ADDED, this.addView);
                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.IMAGE_REMOVED, this.removeView);
                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.IMAGE_DOWNLOADED, this.addProgressBar);
                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_REMOVED, this.removeLayer);
                $imageViewer.remove();
                navigation = null;
            },

            /**
             *    Add progress bar
             *
             *    @param featureData
             *        Contains feature data(layer, feature) and its XMLHttpRequest
             */
            addProgressBar: function (featureData) {
                var id = "imageView_" + UtilsCore.formatId(featureData.feature.properties.identifier) + "_fits";
                var progressBar = new SimpleProgressBar({id: id});
                featureData.xhr.onprogress = progressBar.onprogress.bind(progressBar);
            },

            /**
             *    Add view for the given feature
             *
             *    @returns jQuery element of view
             */
            addView: function (selectedData) {
                console.log("addView",selectedData);
                showImageViewer();

                // Get or create layer view
                var $layer;
                var layer = selectedData.layer;
                if (layers.indexOf(selectedData.layer) < 0) {
                    $layer = createLayerView(selectedData.layer);
                }
                else {
                    $layer = $imageViewer.find('.imageLayers div[id="imageLayer_' + layer.id + '"]');
                }

                var feature = selectedData.feature;
                // Remove special caracters from feature id
                var id = UtilsCore.formatId(selectedData.feature.properties.identifier);
                // Add isFits property for correct progress bar handling
                if (selectedData.isFits) {
                    id += "_fits";
                }

                var name = selectedData.feature.properties.identifier;
                var $li;
                var $metadataDialog;

                if ($layer.find('ul li[id="' + id + '"]').length === 0) {
                    // Create only if not already added
                    var imageViewerItemContent = imageViewerImageItemTemplate({
                        id: id,
                        name: name,
                        isFits: selectedData.isFits
                    });
                    $li = $(imageViewerItemContent)
                        .appendTo($layer.find('ul'))
                        // ZoomTo
                        .find('.zoomTo').button({
                            text: false,
                            icons: {
                                primary: "ui-icon-zoomin"
                            }
                        }).click(function () {

                            var barycenter = UtilsCore.computeGeometryBarycenter(feature.geometry);
                            navigation.zoomTo([barycenter[0], barycenter[1]], 0.1, 2000, function () {
                                // Update selection
                                PickingManager.focusFeature(selectedData, {isExclusive: true});
                            });

                        }).end()
                        // Image visibility
                        .find('input').button({
                            text: false,
                            icons: {
                                primary: "ui-icon-check"
                            }
                        }).click(function () {

                            $(this).button("option", {
                                icons: {
                                    primary: $(this)[0].checked ? "ui-icon-check" : ""
                                }
                            });
                            if ($(this).is(':checked')) {
                                ImageManager.showImage(selectedData);
                            }
                            else {
                                ImageManager.hideImage(selectedData);
                            }
                            mizarWidgetAPI.getRenderContext().requestFrame();
                        }).end()
                        // Delete fits
                        .find('.delete').button({
                            text: false,
                            icons: {
                                primary: "ui-icon-trash"
                            }
                        }).click(function () {
                            // Remove image
                            ImageManager.removeImage(selectedData, selectedData.isFits);
                            if (selectedData.isFits) {
                                ImageProcessing.removeData(selectedData);
                            }
                            mizarWidgetAPI.getRenderContext().requestFrame();
                        }).end()
                        // Image processing
                        .find('.imageProcessing').button({
                            text: false,
                            icons: {
                                primary: "ui-icon-image"
                            }
                        }).click(function () {
                            ImageProcessing.setData(selectedData);
                        }).end()
                        .find('.metadata').button({
                            text: false,
                            icons: {
                                primary: "ui-icon-info"
                            }
                        }).click(function () {

                            // Create metadata dialog if doesn't exist
                            if (!$metadataDialog) {
                                // TODO : refactor this circular dependency...
                                var featurePopup = require("FeaturePopup");
                                var output = featurePopup.generateFeatureMetadata(selectedData.layer, selectedData.feature);
                                $metadataDialog = $('<div>' + output + '</div>').dialog({
                                    autoOpen: true,
                                    show: {
                                        effect: "fade",
                                        duration: 300
                                    },
                                    hide: {
                                        effect: "fade",
                                        duration: 300
                                    },
                                    title: "Metadata",
                                    width: 350,
                                    resizable: false,
                                    zIndex: 12,
                                    stack: false,
                                    close: function () {
                                        $(this).find('.featureProperties').getNiceScroll().remove();
                                        $(this).dialog("destroy").remove();
                                        $metadataDialog = null;
                                    },
                                    drag: function () {
                                        $(this).find('.featureProperties').getNiceScroll().resize();
                                    }
                                });
                                $metadataDialog.find('.featureProperties').niceScroll({
                                    autohidemode: false
                                });
                            }
                            else {
                                if ($metadataDialog.dialog("isOpen")) {
                                    $metadataDialog.dialog("close");
                                }
                            }
                        }).end()
                        .find('.sampExport').button({
                            text: false,
                            icons: {
                                primary: "ui-icon-extlink"
                            }
                        }).click(function () {
                            if (Samp.isConnected()) {
                                Samp.sendImage(feature.services.download.url);
                            }
                            else {
                                ErrorDialog.open("You must be connected to SAMP Hub");
                            }
                        }).end()
                        .fadeIn();

                    $li.find('label.imageName').click(function () {
                        $(this).siblings('.options').slideToggle();
                    });

                    // Disable image processing button for not fits images
                    if (!selectedData.isFits) {
                        $li.find('.imageProcessing').button("disable");
                    }

                    featuresWithImages.push(selectedData);

                    return $li;
                }
            },

            /**
             *    Remove view of the given feature
             */
            removeView: function (selectedData) {
                var id = "imageView_" + UtilsCore.formatId(selectedData.feature.properties.identifier);
                if (selectedData.isFits) {
                    id += "_fits";
                }

                $imageViewer.find('#loadedImages').find('li.image[id="' + id + '"]').fadeOut(function () {

                    // No more loaded image views for current layer
                    if ($(this).siblings().length === 0) {
                        // Remove layer view
                        $imageViewer.find('.imageLayers div[id="imageLayer_' + selectedData.layer.id + '"]').fadeOut(300, function () {
                            // Remove layer view
                            $(this).remove();

                            // Show "No image was loaded"
                            if (layers.length === 0) {
                                $imageViewer.find('#loadedImages p').fadeIn();
                            }
                        });

                        var index = layers.indexOf(selectedData.layer);
                        layers.splice(index, 1);
                    }

                    $(this).remove();
                });

                var featureIndex = featuresWithImages.indexOf(selectedData);
                featuresWithImages.splice(featureIndex, 1);

                selectedData.layer.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_VISIBILITY_CHANGED, onVisibilityChange);
            },

            /**
             *    Remove all image views of the given layer
             */
            removeLayer: function (layer) {
                var $layer = $imageViewer.find('.imageLayers div[id="imageLayer_' + layer.id + '"]');
                $layer.find('ul li').each(function () {
                    $(this).find('.delete').trigger("click");
                });
            },

            getFeatures: function () {
                return featuresWithImages;
            },

            isInitialized : function() {
                return mizarWidgetAPI ? true : false;
            }
        };

    });
