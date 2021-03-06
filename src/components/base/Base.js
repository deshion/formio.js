import maskInput from 'text-mask-all/vanilla';
import Promise from "native-promise-only";
import _get from 'lodash/get';
import _each from 'lodash/each';
import _debounce from 'lodash/debounce';
import _isArray from 'lodash/isArray';
import _clone from 'lodash/clone';
import _defaults from 'lodash/defaults';
import i18next from 'i18next';
import FormioUtils from '../../utils';
import { Validator } from '../Validator';

i18next.initialized = false;

/**
 * This is the BaseComponent class which all elements within the FormioForm derive from.
 */
export class BaseComponent {
  /**
   * Initialize a new BaseComponent.
   *
   * @param {Object} component - The component JSON you wish to initialize.
   * @param {Object} options - The options for this component.
   * @param {Object} data - The global data submission object this component will belong.
   */
  constructor(component, options, data) {
    /**
     * The ID of this component. This value is auto-generated when the component is created, but
     * can also be provided from the component.id value passed into the constructor.
     * @type {string}
     */
    this.id = (component && component.id) ? component.id : Math.random().toString(36).substring(7);

    /**
     * The options for this component.
     * @type {{}}
     */
    this.options = _defaults(_clone(options), {
      highlightErrors: true
    });

    /**
     * The i18n configuration for this component.
     */
    this.options.i18n = this.options.i18n || require('../../locals/en');

    /**
     * The events that are triggered for the whole FormioForm object.
     */
    this.events = this.options.events;

    /**
     * The data object in which this component resides.
     * @type {*}
     */
    this.data = data || {};

    /**
     * The Form.io component JSON schema.
     * @type {*}
     */
    this.component = component || {};

    /**
     * The bounding HTML Element which this component is rendered.
     * @type {null}
     */
    this.element = null;

    /**
     * The HTML Element for the table body. This is relevant for the "multiple" flag on inputs.
     * @type {null}
     */
    this.tbody = null;

    /**
     * The HTMLElement that is assigned to the label of this component.
     * @type {null}
     */
    this.label = null;

    /**
     * The HTMLElement for which the errors are rendered for this component (usually underneath the component).
     * @type {null}
     */
    this.errorElement = null;

    /**
     * The existing error that this component has.
     * @type {string}
     */
    this.error = '';

    /**
     * An array of all of the input HTML Elements that have been added to this component.
     * @type {Array}
     */
    this.inputs = [];

    /**
     * The basic component information which tells the BaseComponent how to render the input element of the components that derive from this class.
     * @type {null}
     */
    this.info = null;

    /**
     * The value of this component
     * @type {*}
     */
    this.value = null;

    /**
     * The row path of this component.
     * @type {number}
     */
    this.row = component ? component.row : '';
    this.row = this.row || '';

    /**
     * Determines if this component is disabled, or not.
     *
     * @type {boolean}
     */
    this._disabled = false;

    /**
     * Determines if this component is visible, or not.
     */
    this._visible = true;

    /**
     * If this input has been input and provided value.
     *
     * @type {boolean}
     */
    this.pristine = true;

    /**
     * The Input mask instance for this component.
     * @type {InputMask}
     */
    this.inputMask = null;

    this.options.name = this.options.name || 'data';

    /**
     * The validators that are assigned to this component.
     * @type {[string]}
     */
    this.validators = ['required', 'minLength', 'maxLength', 'custom', 'pattern', 'json'];

    /**
     * Used to trigger a new change in this component.
     * @type {function} - Call to trigger a change in this component.
     */
    this.triggerChange = _debounce(this.onChange.bind(this), 200);

    /**
     * An array of event handlers so that the destry command can deregister them.
     * @type {Array}
     */
    this.eventHandlers = [];

    /**
     * An array of the event listeners so that the destroy command can deregister them.
     * @type {Array}
     */
    this.eventListeners = [];

    if (this.component) {
      this.type = this.component.type;
      if (this.component.input && this.component.key) {
        this.options.name += '[' + this.component.key + ']';
      }

      /**
       * The element information for creating the input element.
       * @type {*}
       */
      this.info = this.elementInfo();
    }
  }

  /**
   * Translate a text using the i18n system.
   *
   * @param {string} text - The i18n identifier.
   * @param {Object} params - The i18n parameters to use for translation.
   */
  t(text, params) {
    let message = i18next.t(text, params);
    return message;
  }

  /**
   * Register for a new event within this component.
   *
   * @example
   * let component = new BaseComponent({
   *   type: 'textfield',
   *   label: 'First Name',
   *   key: 'firstName'
   * });
   * component.on('componentChange', (changed) => {
   *   console.log('this element is changed.');
   * });
   *
   *
   * @param {string} event - The event you wish to register the handler for.
   * @param {function} cb - The callback handler to handle this event.
   * @param {boolean} internal - This is an internal event handler.
   */
  on(event, cb, internal) {
    if (!this.events) {
      return;
    }
    let type = 'formio.' + event;
    this.eventListeners.push({
      type: type,
      listener: cb,
      internal: internal
    });
    return this.events.on(type, cb);
  }

  /**
   * Emit a new event.
   *
   * @param {string} event - The event to emit.
   * @param {Object} data - The data to emit with the handler.
   */
  emit(event, data) {
    this.events.emit('formio.' + event, data);
  }

  /**
   * Returns an HTMLElement icon element.
   *
   * @param {string} name - The name of the icon to retrieve.
   * @returns {HTMLElement} - The icon element.
   */
  getIcon(name) {
    return this.ce('i', {
      class: 'glyphicon glyphicon-' + name
    });
  }

  /**
   * Perform the localization initialization.
   * @returns {*}
   */
  localize() {
    if (i18next.initialized) {
      return Promise.resolve(i18next);
    }
    i18next.initialized = true;
    return new Promise((resolve, reject) => {
      i18next.init(this.options.i18n, (err, t) => {
        if (err) {
          return reject(err);
        }
        resolve(i18next);
      });
    });
  }

  /**
   * Called before a next page is triggered allowing the components
   * to perform special functions.
   *
   * @return {*}
   */
  beforeNext() {
    return Promise.resolve(true);
  }

  /**
   * Called before a submission is triggered allowing the components
   * to perform special async functions.
   *
   * @return {*}
   */
  beforeSubmit() {
    return Promise.resolve(true);
  }

  /**
   * Builds the component.
   */
  build() {
    this.createElement();
    this.createLabel(this.element);
    if (!this.createWrapper()) {
      this.createInput(this.element);
    }
    this.createDescription(this.element);

    // Disable if needed.
    if (this.options.readOnly || this.component.disabled) {
      this.disabled = true;
    }

    // Set default values.
    let defaultValue = this.defaultValue;
    if (defaultValue) {
      this.setValue(defaultValue);
    }
  }

  /**
   * Retrieves the CSS class name of this component.
   * @returns {string} - The class name of this component.
   */
  get className() {
    let className = this.component.input ? 'form-group has-feedback ' : '';
    className += 'formio-component formio-component-' + this.component.type + ' ';
    if (this.component.key) {
      className += 'formio-component-' + this.component.key + ' ';
    }
    if (this.component.customClass) {
      className += this.component.customClass;
    }
    if (this.component.input && this.component.validate && this.component.validate.required) {
      className += ' required';
    }
    return className;
  }

  /**
   * Build the custom style from the layout values
   * @return {string} - The custom style
   */
  get customStyle() {
    let customCSS = '';
    _each(this.component.style, function(value, key) {
        if (value !== '') {
          customCSS += key + ':' + value + ';';
        }
    });
    return customCSS;
  }

  /**
   * Returns the outside wrapping element of this component.
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Create the outside wrapping element for this component.
   * @returns {HTMLElement}
   */
  createElement() {
    this.element = this.ce('div', {
      id: this.id,
      class: this.className,
      style: this.customStyle
    });

    if (this.element) {
      // Ensure you can get the component info from the element.
      this.element.component = this.component;
    }

    return this.element;
  }

  /**
   * Create the input wrapping element. For multiple, this may be the table wrapper for the elements.
   * @returns {boolean}
   */
  createWrapper() {
    if (!this.component.multiple) {
      return false;
    }
    else {
      let table = this.ce('table', {
        class: 'table table-bordered'
      });
      this.tbody = this.ce('tbody');
      table.appendChild(this.tbody);

      // Add a default value.
      if (!this.data[this.component.key] || !this.data[this.component.key].length) {
        this.addNewValue();
      }

      // Build the rows.
      this.buildRows();

      // Add the table to the element.
      this.append(table);
      return true;
    }
  }

  get defaultValue() {
    let defaultValue = '';
    if (this.component.defaultValue) {
      defaultValue = this.component.defaultValue;
    }
    else if (this.component.customDefaultValue) {
      if (typeof this.component.customDefaultValue === 'string') {
        try {
          let row = this.data;
          let data = this.data;
          let value = '';
          eval(this.component.customDefaultValue.toString());
          defaultValue = value;
        }
        catch (e) {
          defaultValue = null;
          /* eslint-disable no-console */
          console.warn('An error occurred getting default value for ' + this.component.key, e);
          /* eslint-enable no-console */
        }
      }
      else {
        try {
          defaultValue = FormioUtils.jsonLogic.apply(this.component.customDefaultValue, {
            data: this.data,
            row: this.data
          });
        }
        catch (err) {
          defaultValue = null;
          /* eslint-disable no-console */
          console.warn('An error occurred calculating a value for ' + this.component.key, e);
          /* eslint-enable no-console */
        }
      }
    }
    return defaultValue;
  }

  /**
   * Adds a new empty value to the data array.
   */
  addNewValue() {
    if (!this.data[this.component.key]) {
      this.data[this.component.key] = [];
    }
    if (!_isArray(this.data[this.component.key])) {
      this.data[this.component.key] = [this.data[this.component.key]];
    }
    this.data[this.component.key].push(this.defaultValue);
  }

  /**
   * Adds a new empty value to the data array, and add a new row to contain it.
   */
  addValue() {
    this.addNewValue();
    this.buildRows();
  }

  /**
   * Removes a value out of the data array and rebuild the rows.
   * @param {number} index - The index of the data element to remove.
   */
  removeValue(index) {
    if (this.data.hasOwnProperty(this.component.key)) {
      this.data[this.component.key].splice(index, 1);
    }
    this.buildRows();
  }

  /**
   * Rebuild the rows to contain the values of this component.
   */
  buildRows() {
    if (!this.tbody) {
      return;
    }
    this.inputs = [];
    this.tbody.innerHTML = '';
    _each(this.data[this.component.key], (value, index) => {
      let tr = this.ce('tr');
      let td = this.ce('td');
      this.createInput(td);
      tr.appendChild(td);
      let tdAdd = this.ce('td');
      tdAdd.appendChild(this.removeButton(index));
      tr.appendChild(tdAdd);
      this.tbody.appendChild(tr);
    });

    let tr = this.ce('tr');
    let td = this.ce('td', {
      colspan: '2'
    });
    td.appendChild(this.addButton());
    tr.appendChild(td);
    this.tbody.appendChild(tr);
    if (this.options.readOnly || this.component.disabled) {
      this.disabled = true;
    }
  }

  /**
   * Adds a new button to add new rows to the multiple input elements.
   * @returns {HTMLElement} - The "Add New" button html element.
   */
  addButton() {
    let addButton = this.ce('a', {
      class: 'btn btn-primary'
    });
    this.addEventListener(addButton, 'click', (event) => {
      event.preventDefault();
      this.addValue();
    });

    let addIcon = this.ce('span', {
      class: 'glyphicon glyphicon-plus'
    });
    addButton.appendChild(addIcon);
    addButton.appendChild(this.text(this.component.addAnother || ' Add Another'));
    return addButton;
  }

  /**
   * The readible name for this component.
   * @returns {string} - The name of the component.
   */
  get name() {
    return this.component.label || this.component.placeholder || this.component.key;
  }

  /**
   * Creates a new "remove" row button and returns the html element of that button.
   * @param {number} index - The index of the row that should be removed.
   * @returns {HTMLElement} - The html element of the remove button.
   */
  removeButton(index) {
    let removeButton = this.ce('button', {
      type: 'button',
      class: 'btn btn-default',
      tabindex: '-1'
    });

    this.addEventListener(removeButton, 'click', (event) => {
      event.preventDefault();
      this.removeValue(index);
    });

    let removeIcon = this.ce('span', {
      class: 'glyphicon glyphicon-remove-circle'
    });
    removeButton.appendChild(removeIcon);
    return removeButton;
  }

  /**
   * Create the HTML element for the label of this comonent.
   * @param {HTMLElement} container - The containing element that will comtain this label.
   */
  createLabel(container) {
    if (!this.component.label || this.options.inputsOnly) {
      return;
    }
    let className = 'control-label';
    if (this.component.input && this.component.validate && this.component.validate.required) {
      className += ' field-required';
    }
    this.label = this.ce('label', {
      class: className
    });
    if (this.info.attr.id) {
      this.label.setAttribute('for', this.info.attr.id);
    }
    this.label.appendChild(this.text(this.component.label));
    container.appendChild(this.label);
  }

  /**
   * Creates the description block for this input field.
   * @param container
   */
  createDescription(container) {
    if (!this.component.description) {
      return;
    }
    this.description = this.ce('div', {
      class: 'help-block'
    });
    this.description.appendChild(this.text(this.component.description));
    container.appendChild(this.description);
  }

  /**
   * Creates a new error element to hold the errors of this element.
   */
  createErrorElement() {
    if (!this.errorContainer) {
      return;
    }
    this.errorElement = this.ce('div', {
      class: 'formio-errors'
    });
    this.errorContainer.appendChild(this.errorElement);
  }

  /**
   * Adds a prefix html element.
   *
   * @param {HTMLElement} input - The input element.
   * @param {HTMLElement} inputGroup - The group that will hold this prefix.
   * @returns {HTMLElement} - The html element for this prefix.
   */
  addPrefix(input, inputGroup) {
    let prefix = null;
    if (this.component.prefix) {
      prefix = this.ce('div', {
        class: 'input-group-addon'
      });
      prefix.appendChild(this.text(this.component.prefix));
      inputGroup.appendChild(prefix);
    }
    return prefix;
  }

  /**
   * Adds a suffix html element.
   *
   * @param {HTMLElement} input - The input element.
   * @param {HTMLElement} inputGroup - The group that will hold this suffix.
   * @returns {HTMLElement} - The html element for this suffix.
   */
  addSuffix(input, inputGroup) {
    let suffix = null;
    if (this.component.suffix) {
      suffix = this.ce('div', {
        class: 'input-group-addon'
      });
      suffix.appendChild(this.text(this.component.suffix));
      inputGroup.appendChild(suffix);
    }
    return suffix;
  }

  /**
   * Adds a new input group to hold the input html elements.
   *
   * @param {HTMLElement} input - The input html element.
   * @param {HTMLElement} container - The containing html element for this group.
   * @returns {HTMLElement} - The input group element.
   */
  addInputGroup(input, container) {
    let inputGroup = null;
    if (this.component.prefix || this.component.suffix) {
      inputGroup = this.ce('div', {
        class: 'input-group'
      });
      container.appendChild(inputGroup);
    }
    return inputGroup;
  }

  /**
   * Returns an input mask that is compatible with the input mask library.
   * @param {string} mask - The Form.io input mask.
   * @returns {Array} - The input mask for the mask library.
   */
  getInputMask(mask) {
    if (mask instanceof Array) {
      return mask;
    }
    let maskArray = [];
    for (let i=0; i < mask.length; i++) {
      switch (mask[i]) {
        case '9':
          maskArray.push(/\d/);
          break;
        case 'A':
          maskArray.push(/[a-zA-Z]/);
          break;
        case '*':
          maskArray.push(/[a-zA-Z0-9]/);
          break;
        default:
          maskArray.push(mask[i]);
          break;
      }
    }
    return maskArray;
  }

  /**
   * Creates a new input mask placeholder.
   * @param {HTMLElement} mask - The input mask.
   * @returns {string} - The placeholder that will exist within the input as they type.
   */
  maskPlaceholder(mask) {
    return mask.map((char) => {
      return (char instanceof RegExp) ? '_' : char
    }).join('')
  }

  /**
   * Sets the input mask for an input.
   * @param {HTMLElement} input - The html input to apply the mask to.
   */
  setInputMask(input) {
    if (input && this.component.inputMask) {
      let mask = this.getInputMask(this.component.inputMask);
      this.inputMask = maskInput({
        inputElement: input,
        mask: mask
      });
      if (!this.component.placeholder) {
        input.setAttribute('placeholder', this.maskPlaceholder(mask));
      }
    }
  }

  /**
   * Creates a new input element.
   * @param {HTMLElement} container - The container which should hold this new input element.
   * @returns {HTMLElement} - Either the input or the group that contains the input.
   */
  createInput(container) {
    let input = this.ce(this.info.type, this.info.attr);
    this.setInputMask(input);
    let inputGroup = this.addInputGroup(input, container);
    this.addPrefix(input, inputGroup);
    this.addInput(input, inputGroup || container);
    this.addSuffix(input, inputGroup);
    this.errorContainer = container;
    return inputGroup || input;
  }

  /**
   * Wrapper method to add an event listener to an HTML element.
   *
   * @param obj
   *   The DOM element to add the event to.
   * @param evt
   *   The event name to add.
   * @param func
   *   The callback function to be executed when the listener is triggered.
   */
  addEventListener(obj, evt, func) {
    this.eventHandlers.push({type: evt, func: func});
    if ('addEventListener' in obj){
      obj.addEventListener(evt, func, false);
    } else if ('attachEvent' in obj) {
      obj.attachEvent('on' + evt, func);
    }
  }

  /**
   * Remove all event handlers.
   */
  destroy(all) {
    if (this.inputMask) {
      this.inputMask.destroy();
    }
    _each(this.eventListeners, (listener) => {
      if (all || listener.internal) {
        this.events.off(listener.type, listener.listener);
      }
    });
    _each(this.eventHandlers, (handler) => {
      window.removeEventListener(handler.event, handler.func);
    });
  }

  /**
   * Alias for document.createElement.
   *
   * DEPRECATED - @param {string} name - The name of the element to create, for templating purposes.
   * @param {string} type - The type of element to create
   * @param {Object} attr - The element attributes to add to the created element.
   * @param {Various} children - Child elements. Can be a DOM Element, string or array of both.
   * DEPRECATED - @param {Object} events - A key value list of events to attach to the element.
   *
   * @return {HTMLElement} - The created element.
   */
  ce(type, attr, children = null, events = {}) {
    // Create the element.
    let element = document.createElement(type);

    // Add attributes.
    if (attr) {
      this.attr(element, attr);
    }

    // Append different types of children.
    const appendChild = child => {
      if (Array.isArray(child)) {
        child.forEach(oneChild => {
          appendChild(oneChild);
        });
      }
      else if (child instanceof HTMLElement || child instanceof Text) {
        element.appendChild(child);
      }
      else if (child) {
        element.appendChild(this.text(child.toString()));
      }
    };

    appendChild(children);

    return element;
  }

  /**
   * Alias to create a text node.
   * @param text
   * @returns {Text}
   */
  text(text) {
    return document.createTextNode(text);
  }

  /**
   * Adds an object of attributes onto an element.
   * @param {HtmlElement} element - The element to add the attributes to.
   * @param {Object} attr - The attributes to add to the input element.
   */
  attr(element, attr) {
    _each(attr, (value, key) => {
      if (typeof value !== 'undefined') {
        if (key.indexOf('on') === 0) {
          // If this is an event, add a listener.
          this.addEventListener(element, key.substr(2).toLowerCase(), value);
        }
        else {
          // Otherwise it is just an attribute.
          element.setAttribute(key, value);
        }
      }
    });
  }

  /**
   * Adds a class to a DOM element.
   *
   * @param element
   *   The element to add a class to.
   * @param className
   *   The name of the class to add.
   */
  addClass(element, className) {
    var cls = element.getAttribute('class');
    cls += (' ' + className);
    element.setAttribute('class', cls);
  }

  /**
   * Remove a class from a DOM element.
   *
   * @param element
   *   The DOM element to remove the class from.
   * @param className
   *   The name of the class that is to be removed.
   */
  removeClass(element, className) {
    var cls = element.getAttribute('class');
    cls = cls.replace(className, '');
    element.setAttribute('class', cls);
  }

  /**
   * Check for conditionals and hide/show the element based on those conditions.
   */
  checkConditions(data) {
    return this.show(FormioUtils.checkCondition(this.component, this.data, data));
  }

  /**
   * Add a new input error to this element.
   * @param message
   */
  addInputError(message, dirty) {
    if (!message) {
      return;
    }

    if (this.errorElement) {
      let errorMessage = this.ce('p', {
        class: 'help-block'
      });
      errorMessage.appendChild(this.text(message));
      this.errorElement.appendChild(errorMessage);
    }

    // Add error classes
    this.addClass(this.element, 'has-error');
    if (dirty && this.options.highlightErrors) {
      this.addClass(this.element, 'alert alert-danger');
    }
  }

  /**
   * Hide or Show an element.
   *
   * @param show
   */
  show(show) {
    this._visible = show;
    let element = this.getElement();
    if (element) {
      if (show && !this.component.hidden) {
        element.removeAttribute('hidden');
        element.style.visibility = 'visible';
        element.style.position = 'relative';
      }
      else if (!show || this.component.hidden) {
        element.setAttribute('hidden', true);
        element.style.visibility = 'hidden';
        element.style.position = 'absolute';
      }
    }
    return show;
  }

  set visible(visible) {
    this.show(visible);
  }

  get visible() {
    return this._visible;
  }

  onChange(noValidate) {
    if (!noValidate) {
      this.pristine = false;
    }
    if (this.events) {
      this.emit('componentChange', {
        component: this.component,
        value: this.value,
        validate: !noValidate
      });
    }
  }

  addInputSubmitListener(input) {
    this.addEventListener(input, 'keypress', (event) => {
      let key = event.keyCode || event.which;
      if (key == 13) {
        event.preventDefault();
        event.stopPropagation();
        this.emit('submitButton');
      }
    });
  }

  /**
   * Add new input element listeners.
   *
   * @param input
   */
  addInputEventListener(input) {
    this.addEventListener(input, this.info.changeEvent, () => this.updateValue());
  }

  /**
   * Add a new input to this comonent.
   *
   * @param input
   * @param container
   * @param name
   */
  addInput(input, container, noSet) {
    if (input && container) {
      this.inputs.push(input);
      input = container.appendChild(input);
    }
    this.addInputEventListener(input);
    this.addInputSubmitListener(input);

    // Reset the values of the inputs.
    if (!noSet && this.data && this.data.hasOwnProperty(this.component.key)) {
      this.setValue(this.data[this.component.key], true);
    }
  }

  /**
   * Get the value at a specific index.
   *
   * @param index
   * @returns {*}
   */
  getValueAt(index) {
    return this.inputs[index].value;
  }

  getValue() {
    if (!this.component.input) {
      return;
    }
    let values = [];
    for (let i in this.inputs) {
      if (!this.component.multiple) {
        this.value = this.getValueAt(i);
        return this.value;
      }
      values.push(this.getValueAt(i));
    }
    this.value = values;
    return values;
  }

  updateValue(noValidate) {
    let value = this.data[this.component.key];
    let falsey = !value && (value !== null) && (value !== undefined);
    this.data[this.component.key] = this.getValue();
    let changed = (value !== this.data[this.component.key]);
    if (!changed) {
      return;
    }
    if (falsey) {
      if (!!this.data[this.component.key]) {
        this.triggerChange(noValidate);
      }
    }
    else {
      this.triggerChange(noValidate);
    }
  }

  /**
   * Perform a calculated value operation.
   *
   * @param data - The global data object.
   */
  calculateValue(data) {
    if (!this.component.calculateValue) {
      return;
    }

    // If this is a string, then use eval to evalulate it.
    if (typeof this.component.calculateValue === 'string') {
      try {
        let value = [];
        let row = this.data;
        eval(this.component.calculateValue.toString());
        this.setValue(value);
      }
      catch (e) {
        /* eslint-disable no-console */
        console.warn('An error occurred calculating a value for ' + this.component.key, e);
        /* eslint-enable no-console */
      }
    }
    else {
      try {
        let val = FormioUtils.jsonLogic.apply(this.component.calculateValue, {
          data: data,
          row: this.data
        });
        this.setValue(val);
      }
      catch (err) {
        /* eslint-disable no-console */
        console.warn('An error occurred calculating a value for ' + this.component.key, e);
        /* eslint-enable no-console */
      }
    }
  }

  checkValidity(data, dirty) {
    // No need to check for errors if there is no input or if it is pristine.
    if (!this.component.input || (!dirty && this.pristine)) {
      return true;
    }

    let message = Validator.check(this, data);
    this.setCustomValidity(message, dirty);

    // No message, returns true
    return message ? false : true;
  }

  getRawValue() {
    return this.data[this.component.key];
  }

  isEmpty(value) {
    return value == null || value.length === 0;
  }

  get errors() {
    return this.error ? [this.error] : [];
  }

  interpolate(string, data) {
    return FormioUtils.interpolate(string, data);
  }

  setCustomValidity(message, dirty) {
    if (this.errorElement && this.errorContainer) {
      this.errorElement.innerHTML = '';
      try {
        this.errorContainer.removeChild(this.errorElement);
      }
      catch (err) {}
    }
    this.removeClass(this.element, 'has-error');
    if (this.options.highlightErrors) {
      this.removeClass(this.element, 'alert alert-danger');
    }
    if (message) {
      this.error = {
        component: this.component,
        message: message
      };
      this.emit('componentError', this.error);
      this.createErrorElement();
      this.addInputError(message, dirty);
    }
    else {
      this.error = null;
    }
    _each(this.inputs, (input) => {
      if (typeof input.setCustomValidity === 'function') {
        input.setCustomValidity(message, dirty);
      }
    });
  }

  /**
   * Set the value at a specific index.
   *
   * @param index
   * @param value
   */
  setValueAt(index, value) {
    if (value === null || value === undefined) {
      value = this.defaultValue;
    }
    this.inputs[index].value = value;
  }

  /**
   * Set the value of this component.
   * @param value
   */
  setValue(value, noUpdate, noValidate) {
    if (!this.component.input) {
      return;
    }
    this.value = value;
    let isArray = _isArray(value);
    for (let i in this.inputs) {
      this.setValueAt(i, isArray ? value[i] : value);
    }
    if (!noUpdate) {
      this.updateValue(noValidate);
    }
  }

  /**
   * Prints out the value of this component as a string value.
   */
  asString(value) {
    value = value || this.getValue();
    return _isArray(value) ? value.join(', ') : value.toString();
  }

  /**
   * Return if the component is disabled.
   * @return {boolean}
   */
  get disabled() {
    return this._disabled;
  }

  /**
   * Disable this component.
   *
   * @param {boolean} disabled
   */
  set disabled(disabled) {
    this._disabled = disabled;
    // Disable all input.
    _each(this.inputs, (input) => {
      input.disabled = disabled;
      if (disabled) {
        input.setAttribute('disabled', 'disabled');
      }
      else {
        input.removeAttribute('disabled');
      }
    });
  }

  selectOptions(select, tag, options, defaultValue) {
    _each(options, (option) => {
      let attrs = {
        value: option.value
      };
      if (defaultValue !== undefined && (option.value === defaultValue)) {
        attrs.selected = 'selected';
      }
      let optionElement = this.ce('option', attrs);
      optionElement.appendChild(this.text(option.label));
      select.appendChild(optionElement);
    });
  }

  setSelectValue(select, value) {
    let options = select.querySelectorAll('option');
    _each(options, (option) => {
      if (option.value === value) {
        option.setAttribute('selected', 'selected');
      }
      else {
        option.removeAttribute('selected');
      }
    });
    if (select.onchange) {
      select.onchange();
    }
    if (select.onselect) {
      select.onchange();
    }
  }

  clear() {
    this.destroy();
    let element = this.getElement();
    if (element) {
      element.innerHTML = '';
    }
  }

  append(element) {
    if (this.element) {
      this.element.appendChild(element);
    }
  }

  prepend(element) {
    if (this.element && this.element.firstChild) {
      this.element.insertBefore(element, this.element.firstChild);
    }
  }

  removeChild(element) {
    if (this.element) {
      this.element.removeChild(element);
    }
  }

  /**
   * Get the element information.
   */
  elementInfo() {
    let attributes = {
      name: this.options.name,
      type: this.component.inputType || 'text',
      class: 'form-control'
    };
    _each({
      tabindex: 'tabindex',
      placeholder: 'placeholder'
    }, (path, prop) => {
      let attrValue = _get(this.component, path);
      if (attrValue) {
        attributes[prop] = attrValue;
      }
    });
    return {
      type: 'input',
      component: this.component,
      changeEvent: 'change',
      attr: attributes
    };
  }
}

BaseComponent.externalLibraries = {};
BaseComponent.requireLibrary = function(name, property, src, polling) {
  if (!BaseComponent.externalLibraries.hasOwnProperty(name)) {
    BaseComponent.externalLibraries[name] = {};
    BaseComponent.externalLibraries[name].ready = new Promise((resolve, reject) => {
      BaseComponent.externalLibraries[name].resolve = resolve;
      BaseComponent.externalLibraries[name].reject = reject;
    });

    if (!polling && !window[name + 'Callback']) {
      window[name + 'Callback'] = function() {
        this.resolve();
      }.bind(BaseComponent.externalLibraries[name]);
    }

    // See if the plugin already exists.
    let plugin = _get(window, property);
    if (plugin) {
      BaseComponent.externalLibraries[name].resolve(plugin);
    }
    else {
      src = _isArray(src) ? src : [src];
      src.forEach((lib) => {
        let attrs = {};
        let elementType = '';
        if (typeof lib === 'string') {
          lib = {
            type: 'script',
            src: lib
          };
        }
        switch (lib.type) {
          case 'script':
            elementType = 'script';
            attrs = {
              src: lib.src,
              type: 'text/javascript',
              defer: true,
              async: true
            };
            break;
          case 'styles':
            elementType = 'link';
            attrs = {
              href: lib.src,
              rel: 'stylesheet'
            };
            break;
        }

        // Add the script to the top page.
        let script = document.createElement(elementType);
        for (let attr in attrs) {
          script.setAttribute(attr, attrs[attr]);
        }
        document.getElementsByTagName('head')[0].appendChild(script);
      });

      // if no callback is provided, then check periodically for the script.
      if (polling) {
        setTimeout(function checkLibrary() {
          let plugin = _get(window, property);
          if (plugin) {
            BaseComponent.externalLibraries[name].resolve(plugin);
          }
          else {
            // check again after 200 ms.
            setTimeout(checkLibrary, 200);
          }
        }, 200)
      }
    }
  }
  return BaseComponent.externalLibraries[name].ready;
};

BaseComponent.libraryReady = function(name) {
  if (
    BaseComponent.externalLibraries.hasOwnProperty(name) &&
    BaseComponent.externalLibraries[name].ready
  ) {
    return BaseComponent.externalLibraries[name].ready;
  }

  return Promise.reject(name + ' library was not required.');
};
