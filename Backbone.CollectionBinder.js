// Backbone.CollectionBinder v1.1.0
// (c) 2015 Bart Wood
// Distributed Under MIT License

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['underscore', 'jquery', 'backbone', 'Backbone.ModelBinder'], factory);
    }
    else if(typeof module !== 'undefined' && module.exports) {
        // CommonJS
        module.exports = factory(
            require('underscore'),
            require('jquery'),
            require('backbone')
        );
    }
    else {
        // Browser globals
        factory(_, $, Backbone);
    }
}
(function(_, $, Backbone){

    if(!Backbone){
        throw new Error('Please include Backbone.js before Backbone.ModelBinder.js');
    }

    if(!Backbone.ModelBinder){
        throw new Error('Please include Backbone.ModelBinder.js before Backbone.CollectionBinder.js');
    }

    Backbone.CollectionBinder = function(elManagerFactory, options){
        _.bindAll.apply(_, [this].concat(_.functions(this)));
        this._elManagers = {};

        this._elManagerFactory = elManagerFactory;
        if(!this._elManagerFactory) throw new Error('elManagerFactory must be defined.');

        // Let the factory just use the trigger function on the view binder
        this._elManagerFactory.trigger = this.trigger;

        this._options = _.extend({}, Backbone.CollectionBinder.options, options);
    };

    // Static setter for class level options
    Backbone.CollectionBinder.SetOptions = function(options){
        Backbone.CollectionBinder.options = options;
    };

    Backbone.CollectionBinder.VERSION = '1.1.0';

    _.extend(Backbone.CollectionBinder.prototype, Backbone.Events, {
        bind: function(collection, parentEl){
            this.unbind();

            if(!collection) throw new Error('collection must be defined');
            if(!parentEl) throw new Error('parentEl must be defined');

            this._collection = collection;
            this._elManagerFactory._setParentEl(parentEl);

            this._onCollectionReset();

            this._collection.on('add', this._onCollectionAdd, this);
            this._collection.on('remove', this._onCollectionRemove, this);
            this._collection.on('reset', this._onCollectionReset, this);
            this._collection.on('sort', this._onCollectionSort, this);
        },

        unbind: function(){
            if(this._collection !== undefined){
                this._collection.off('add', this._onCollectionAdd);
                this._collection.off('remove', this._onCollectionRemove);
                this._collection.off('reset', this._onCollectionReset);
                this._collection.off('sort', this._onCollectionSort);
            }

            this._removeAllElManagers();
        },

        getManagerForEl: function(el){
            var i, elManager, elManagers = _.values(this._elManagers);

            for(i = 0; i < elManagers.length; i++){
                elManager = elManagers[i];

                if(elManager.isElContained(el)){
                    return elManager;
                }
            }

            return undefined;
        },

        getManagerForModel: function(model){
           return this._elManagers[_.isObject(model)? model.cid : model];
        },

        _onCollectionAdd: function(model, collection, options){
            var manager = this._elManagers[model.cid] = this._elManagerFactory.makeElManager(model);
            manager.createEl();

            var position = options && options.at;

            if (this._options['autoSort'] && position != null && position < this._collection.length - 1) {
                this._moveElToPosition(manager.getEl(), position);
            }
        },

        _onCollectionRemove: function(model){
            this._removeElManager(model);
        },

        _onCollectionReset: function(){
            this._removeAllElManagers();

            this._collection.each(function(model){
                this._onCollectionAdd(model);
            }, this);

            this.trigger('elsReset', this._collection);
        },

        _onCollectionSort: function() {
            if(this._options['autoSort']){
                this.sortRootEls();
            }
        },

        _removeAllElManagers: function(){
            _.each(this._elManagers, function(elManager){
                elManager.removeEl();
                delete this._elManagers[elManager._model.cid];
            }, this);

            delete this._elManagers;
            this._elManagers = {};
        },

        _removeElManager: function(model){
            if(this._elManagers[model.cid] !== undefined){
                this._elManagers[model.cid].removeEl();
                delete this._elManagers[model.cid];
            }
        },

        _moveElToPosition: function (modelEl, position) {
            var nextModel = this._collection.at(position + 1);
            if (!nextModel) return;

            var nextManager = this.getManagerForModel(nextModel);
            if (!nextManager) return;

            var nextEl = nextManager.getEl();
            if (!nextEl) return;

            modelEl.detach();
            modelEl.insertBefore(nextEl);
        },

        sortRootEls: function(){
            this._collection.each(function(model, modelIndex){
                var modelElManager = this.getManagerForModel(model);
                if(modelElManager){
                    var modelEl = modelElManager.getEl();
                    var currentRootEls = $(this._elManagerFactory._getParentEl()).children();

                    if(currentRootEls[modelIndex] !== modelEl[0]){
                        modelEl.detach();
                        modelEl.insertBefore(currentRootEls[modelIndex]);
                    }
                }
            }, this);
        }
    });

    // The ElManagerFactory is used for els that are just html templates
    // elHtml - how the model's html will be rendered.  Must have a single root element (div,span).
    // bindings (optional) - either a string which is the binding attribute (name, id, data-name, etc.) or a normal bindings hash
    Backbone.CollectionBinder.ElManagerFactory = function(elHtml, bindings){
        _.bindAll.apply(_, [this].concat(_.functions(this)));

        this._elHtml = elHtml;
        this._bindings = bindings;

        if(!_.isFunction(this._elHtml) && ! _.isString(this._elHtml)) throw new Error('elHtml must be a compliled template or an html string');
    };

    _.extend(Backbone.CollectionBinder.ElManagerFactory.prototype, {
        _setParentEl: function(parentEl){
            this._parentEl = parentEl;
        },

        _getParentEl: function(){
            return this._parentEl;
        },

        makeElManager: function(model){

            var elManager = {
                _model: model,

                createEl: function(){
                    this._el = _.isFunction(this._elHtml) ? $(this._elHtml({model: this._model.toJSON()})) : $(this._elHtml);
                    $(this._parentEl).append(this._el);

                    if(this._bindings){
                        if(_.isString(this._bindings)){
                            this._modelBinder = new Backbone.ModelBinder();
                            this._modelBinder.bind(this._model, this._el, Backbone.ModelBinder.createDefaultBindings(this._el, this._bindings));
                        }
                        else if(_.isObject(this._bindings)){
                            this._modelBinder = new Backbone.ModelBinder();
                            this._modelBinder.bind(this._model, this._el, this._bindings);
                        }
                        else {
                            throw new Error('Unsupported bindings type, please use a boolean or a bindings hash');
                        }
                    }

                    this.trigger('elCreated', this._model, this._el);
                },

                removeEl: function(){
                    if(this._modelBinder !== undefined){
                        this._modelBinder.unbind();
                    }

                    this._el.remove();
                    this.trigger('elRemoved', this._model, this._el);
                },

                isElContained: function(findEl){
                    return this._el === findEl || $(this._el).has(findEl).length > 0;
                },

                getModel: function(){
                    return this._model;
                },

                getEl: function(){
                    return this._el;
                }
            };

            _.extend(elManager, this);
            return elManager;
        }
    });


    // The ViewManagerFactory is used for els that are created and owned by backbone views.
    // There is no bindings option because the view made by the viewCreator should take care of any binding
    // viewCreator - a callback that will create backbone view instances for a model passed to the callback
    Backbone.CollectionBinder.ViewManagerFactory = function(viewCreator){
        _.bindAll.apply(_, [this].concat(_.functions(this)));
        this._viewCreator = viewCreator;

        if(!_.isFunction(this._viewCreator)) throw new Error('viewCreator must be a valid function that accepts a model and returns a backbone view');
    };

    _.extend(Backbone.CollectionBinder.ViewManagerFactory.prototype, {
        _setParentEl: function(parentEl){
            this._parentEl = parentEl;
        },

        _getParentEl: function(){
            return this._parentEl;
        },

        makeElManager: function(model){
            var elManager = {

                _model: model,

                createEl: function(){
                    this._view = this._viewCreator(model);
                    this._view.render(this._model);
                    $(this._parentEl).append(this._view.el);

                    this.trigger('elCreated', this._model, this._view);
                },

                removeEl: function(){
                    if(this._view.close !== undefined){
                        this._view.close();
                    }
                    else {
                        this._view.$el.remove();
                        console && console.log && console.log('warning, you should implement a close() function for your view, you might end up with zombies');
                    }

                    this.trigger('elRemoved', this._model, this._view);
                },

                isElContained: function(findEl){
                    return this._view.el === findEl || this._view.$el.has(findEl).length > 0;
                },

                getModel: function(){
                    return this._model;
                },

                getView: function(){
                    return this._view;
                },

                getEl: function(){
                    return this._view.$el;
                }
            };

            _.extend(elManager, this);

            return elManager;
        }
    });

}));
