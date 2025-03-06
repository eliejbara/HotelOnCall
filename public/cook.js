document.addEventListener("DOMContentLoaded", () => {
    const ordersContainer = document.getElementById("orders-container");

    // Store the current status of orders to persist during the refresh
    let statusCache = {};

    // Fetch orders from the server
    function fetchOrders() {
        fetch("/cook/orders")
            .then(res => res.json())
            .then(data => {
                console.log("✅ Orders received:", data);
                ordersContainer.innerHTML = ""; // Clear the current orders

                data.forEach(order => {
                    const orderBox = document.createElement("div");
                    orderBox.className = "order-box";
                    orderBox.innerHTML = `
                        <p><b>Order ID:</b> ${order.id}</p>
                        <p><b>User:</b> ${order.guest_email}</p>
                        <p><b>Food:</b> ${order.menu_item} x${order.quantity}</p>
                        <p><b>Status:</b> <span id="status-text-${order.id}">${order.order_status}</span></p>
                        <select id="status-${order.id}">
                            <option value="Pending" ${order.order_status === "Pending" ? "selected" : ""}>Pending</option>
                            <option value="In Progress" ${order.order_status === "In Progress" ? "selected" : ""}>In Progress</option>
                            <option value="Completed" ${order.order_status === "Completed" ? "selected" : ""}>Completed</option>
                        </select>
                        <button id="updateBtn-${order.id}">Update</button>
                    `;
                    ordersContainer.appendChild(orderBox);

                    // Apply cached status if available
                    const statusSelect = document.getElementById(`status-${order.id}`);
                    if (statusCache[order.id]) {
                        statusSelect.value = statusCache[order.id];
                    }

                    // Cache status change
                    statusSelect.addEventListener("change", () => {
                        statusCache[order.id] = statusSelect.value;
                    });

                    // Attach event listener for update button
                    const updateBtn = document.getElementById(`updateBtn-${order.id}`);
                    updateBtn.addEventListener("click", () => updateOrder(order.id));
                });
            })
            .catch(err => console.error("Error fetching orders:", err));
    }

    // Define updateOrder to avoid errors (implement your logic as needed)
    function updateOrder(orderId) {
        console.log("Update order clicked for order", orderId);
        // Your update logic here...
    }

    // Initial fetch and refresh every 5 seconds
    fetchOrders();
    setInterval(fetchOrders, 5000);
});
