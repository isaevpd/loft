/**
 * Created by hlfrmn on 5/15/2016.
 */

var BASE_MINUTE_PRICE = 2;
var DISCOUNTED_MINUTE_PRICE = 1.5;
var MINUTES_FOR_DISCOUNT = 60;
var STOP_CHECK = 350;


function calculateTimeCost(time) {
    var timeCost = 0;
    if (time >= MINUTES_FOR_DISCOUNT) {
        time -= MINUTES_FOR_DISCOUNT;
        timeCost += MINUTES_FOR_DISCOUNT * DISCOUNTED_MINUTE_PRICE;
    }

    timeCost += time * BASE_MINUTE_PRICE;
    return parseFloat(timeCost);
}

function calculateOrdersCost(orders) {
    var ordersCost = 0;
    orders.forEach(function (order) {
        ordersCost += order.price;
    });
    return parseFloat(ordersCost);
}

function calculateTotalCost(customer) {
    //timeCost stores the cost of time (without extra orders)
    var timeCost = calculateTimeCost(customer.getTimeSpentMinutes());
    // timeRate is 1 for no discounts, less with discounts
    // e.g. 0.75 for a 25% discount
    var timeRate = getDiscount(customer.id);
    timeCost = (timeCost * timeRate) > 350 ? 350 : (timeCost * timeRate);
    // ordersCost stores how much are the extra orders
    var ordersCost = calculateOrdersCost(customer.orders);

    return timeCost + ordersCost;
}
////////////////////////////////////////
//////////////  Classes  ///////////////
////////////////////////////////////////

function Customer(id, name, start, discount) {
    this.name = name;
    this.id = id;
    this.start = start;
    if (discount) {
        this.discount = parseInt(discount) / 100;
    }
    else {
        this.discount = 0;
    }

    this.orders = [];
    this.timeTotal = 0;
    this.moneyTotal = 0;
    this.discountTotal = 0;
    // saving intervals to a variable,
    // so as to clear the intervals on destruction
    this.timeInterval = setInterval(this.updateTime.bind(this), 1000);
    this.moneyInterval = setInterval(this.updateMoney.bind(this), 1000);
}

Customer.prototype = {
    addOrder: function (orderObj) {
        this.orders.push(orderObj);
    },
    removeOrder: function (order) {
        var index = this.orders.indexOf(order);
        if (index > -1) {
            this.orders.splice(index, 1);
        }
        else {
            console.log('Order deletion error - order not found.')
        }
    },
    checkOut: function () {
        return {total: this.moneyTotal, discount: this.discountTotal};
    },
    getTimeSpentSeconds: function () {
        return Math.floor(this.timeTotal / (1000));
    },
    getTimeSpentMinutes: function () {
        return Math.floor(this.timeTotal / (1000 * 60));
    },
    updateTime: function () {
        this.timeTotal = Date.now() - this.start;
    },
    updateMoney: function () {
        //timeCost stores the cost of time (without extra orders)
        var timeCost = calculateTimeCost(this.getTimeSpentMinutes());
        // timeRate is 1 for no discounts, less with discounts
        // e.g. 0.75 for a 25% discount
        var timeRate = 1 - this.discount;
        var totalTimeCost = (timeCost * timeRate) > STOP_CHECK ? STOP_CHECK : (timeCost * timeRate);
        this.discountTotal = totalTimeCost - (timeCost > STOP_CHECK ? STOP_CHECK : timeCost);

        // ordersCost stores how much are the extra orders
        var ordersCost = calculateOrdersCost(this.orders);
        this.moneyTotal = totalTimeCost + ordersCost;
    },
    clearIntervals: function () {
        clearInterval(this.timeInterval);
        clearInterval(this.moneyInterval);
    }
};

Customer.validate = function (obj) {
    // console.log("hellooo");
    if ((!obj.name || (obj.name === '')) && (!obj.id || (!obj.id > 0))) {
        console.log('Customer name validation failed.');
        return false;
    }
    // if ((!obj.id) || (!obj.id > 0)){
    //     console.log('Customer id validation failed.');
    //     return false;
    // }
    return true;
};


//////////////////////////  MVC  //////////////////////////////


//////////////////////////////////////////////////////////////
////////////////////////  MODEL  /////////////////////////////
//////////////////////////////////////////////////////////////


var model = {
    init: function () {
        this.customers = [];
        if (!localStorage.loft) {
            localStorage.loft = JSON.stringify([]);
        }
        else {
            var backup = JSON.parse(localStorage.loft);
            localStorage.loft = JSON.stringify([]);
            model.restoreFromBackup(backup);
        }
    },
    addCustomer: function (obj) {
        if (Customer.validate(obj)) {
            var customer = new Customer(obj.id, obj.name, obj.start ? new Date(obj.start) : Date.now(), obj.discount);
            this.customers.push(customer);
            localStorage.loft = JSON.stringify(this.customers);
        }
        else {
            console.log('Customer data validation error on creation!');
        }
        return customer;
    },
    deleteCustomer: function (customer) {
        var index = this.customers.indexOf(customer);
        if (index > -1) {
            customer.clearIntervals();
            this.customers.splice(index, 1);
            localStorage.loft = JSON.stringify(this.customers);
        }
        else {
            console.log('Deletion error: customer not in the list!');
        }
    },
    getAllCustomers: function () {
        return this.customers;
    },
    deleteAllCustomers: function () {
        this.customers.forEach(function (customer) {
            customer.clearIntervals();
        });
        this.customers.length = 0;
        localStorage.loft = JSON.stringify([]);
    },
    checkOutCustomer: function (customer) {
        customer.checkOut();
    },
    addOrderToCustomer: function (customer, order) {
        var index = this.customers.indexOf(customer);
        if (index > -1) {
            customer.addOrder(order);
            localStorage.loft = JSON.stringify(this.customers);
        }
        else {
            console.log('Add order error: customer not in the list!');
        }
    },
    restoreFromBackup: function (backup) {
        backup.forEach(function (customer) {
            var addedCustomer = model.addCustomer(customer);
            customer.orders.forEach(function (order) {
                model.addOrderToCustomer(addedCustomer, order);
            });
        });

    }

};

////////////////////////////////////////////////////////////////
//////////////////////////  VIEW  //////////////////////////////
////////////////////////////////////////////////////////////////

var view = {
    init: function () {
        // declare variables from the DOM
        // First, the form
        var customerForm = document.getElementById('customer-add-form');
        var customerAddName = document.getElementById('customer-add-name');
        var customerAddId = document.getElementById('customer-add-id');
        // The list view
        this.customerList = document.getElementById('customer-list');
        // The details view
        this.customerDetails = document.getElementById('customer-details');
        this.customerNameId = document.getElementById('customer-name-id');
        this.customerTimeValue = document.getElementById('customer-time-value');
        this.customerMoneyValue = document.getElementById('customer-money-value');
        this.customerButtons = document.getElementById('customer-details-buttons');

        this.customerListHandles = [];

        customerForm.addEventListener('submit', function (e) {
            // console.log('Add initiated from form.');
            e.preventDefault();
            var obj = {
                name: customerAddName.value,
                id: customerAddId.value
            };
            controller.addCustomer(obj);
            customerForm.reset();
        });

        this.render();

    },

    render: function () {
        // render customer list: first clear it,
        // then render blocks for each customer
        this.customerListHandles.forEach(function (handle) {
            clearInterval(handle);
        });

        this.customerList.innerHTML = '';

        controller.getAllCustomers().forEach(function (customer) {
            view.createCustomerBlock(customer);
        });
    },

    renderDetails: function (customer) {

        this.customerNameId.textContent = customer.name + ' - ' + customer.id;

        this.customerTimeValue.textContent = customer.getTimeSpentMinutes();
        this.customerMoneyValue.textContent = customer.moneyTotal;

        this.customerButtons.innerHTML = '';

        var checkoutBtn = document.createElement('button');
        checkoutBtn.type = 'button';
        checkoutBtn.textContent = 'Checkout';
        checkoutBtn.addEventListener('click', (function (customer) {
            return function () {
                controller.checkOutCustomer(customer);
            }
        })(customer));

        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (function (customer) {
            return function () {
                controller.deleteCustomer(customer);
            }
        })(customer));

        var orderForm = document.createElement('form');
        this.customerButtons.appendChild(orderForm);

        var orderNameInput = document.createElement('input');
        orderNameInput.type = 'text';
        orderNameInput.placeholder = 'Order name';
        orderForm.appendChild(orderNameInput);

        var orderPriceInput = document.createElement('input');
        orderPriceInput.type = 'number';
        orderPriceInput.placeholder = 'Order price';
        orderForm.appendChild(orderPriceInput);

        var orderSubmitBtn = document.createElement('button');
        orderSubmitBtn.type = 'submit';
        orderSubmitBtn.textContent = 'Add order';
        orderSubmitBtn.addEventListener('click', (function (customer) {
            return function (e) {
                e.preventDefault();
                var order = {name: orderNameInput.value, price: parseFloat(orderPriceInput.value)};
                controller.addOrderToCustomer(customer, order);
                orderForm.reset();
            }
        })(customer));

        this.customerButtons.appendChild(checkoutBtn);
        this.customerButtons.appendChild(deleteBtn);
        this.customerButtons.appendChild(orderSubmitBtn);
    },

    createCustomerBlock: function (customer) {
        var tr = document.createElement('tr');
        tr.setAttribute('data-toggle', 'modal');
        tr.setAttribute('data-target', '#showDetailsModal');

        var custName = document.createElement('td');
        custName.textContent = customer.name;
        var custId = document.createElement('td');
        custId.textContent = customer.id;

        var custTime = document.createElement('td');
        custTime.textContent = '0';
        var timeHandle = setInterval(((function (customer) {
            return function () {
                if (customer.getTimeSpentSeconds() < 60) {
                    custTime.textContent = customer.getTimeSpentSeconds() + ' s';
                }
                else {
                    custTime.textContent = customer.getTimeSpentMinutes() + ' m';
                }
            }
        })(customer)), 1000);
        this.customerListHandles.push(timeHandle);

        var custMoney = document.createElement('td');
        custMoney.textContent = customer.moneyTotal;
        var moneyHandle = setInterval(((function (customer) {
            return function () {
                custMoney.textContent = customer.moneyTotal;
            }
        })(customer)), 1000);
        this.customerListHandles.push(moneyHandle);

        tr.appendChild(custName);
        tr.appendChild(custId);
        tr.appendChild(custTime);
        tr.appendChild(custMoney);

        tr.addEventListener('click', (function (customer) {
            return function () {
                view.renderDetails(customer);
                tr.classList.toggle('active');
            }
        })(customer));

        this.customerList.appendChild(tr);
    }
};

////////////////////////////////////////////////////////////////
///////////////////////  CONTROLLER  ///////////////////////////
////////////////////////////////////////////////////////////////

var controller = {
    init: function () {
        model.init();
        view.init();
    },
    addCustomer: function (obj) {
        model.addCustomer(obj);
        view.render();
    },
    deleteCustomer: function (customer) {
        model.deleteCustomer(customer);
        view.render();
    },
    getAllCustomers: function () {
        return model.getAllCustomers();
    },
    deleteAllCustomers: function () {
        model.deleteAllCustomers();
        view.render();
    },
    checkOutCustomer: function (customer) {
        model.checkOutCustomer(customer);
    },
    addOrderToCustomer: function (customer, order) {
        model.addOrderToCustomer(customer, order);

    }
};

function test() {
    setTimeout(function () {
        controller.addCustomer({name: 'pavel', id: 321})
    }, 1000);
    setTimeout(function () {
        controller.addCustomer({name: 'jay', id: 123})
    }, 8 * 1000);
    setTimeout(function () {
        controller.addCustomer({name: 'amir', id: 666})
    }, 13 * 1000);
}


controller.init();
// test();