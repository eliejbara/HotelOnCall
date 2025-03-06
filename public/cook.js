document.addEventListener("DOMContentLoaded", () => {
    const ordersContainer = document.getElementById("orders-container");

    // Store the current status of orders to persist during refresh
    let statusCache = {};

    // Fetch orders from the server
    function fetchOrders() {
        fetch("/cook/orders")
            .then(res => res.json())
            .then(data => {
                console.log("✅ Orders received:", data);
                // Clear the current orders
                ordersContainer.innerHTML = "";

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

    // Define updateOrder function
    function updateOrder(orderId) {
        console.log("updateOrder triggered for order", orderId);
        // Get the new status from the select element
        const statusSelect = document.getElementById(`status-${orderId}`);
        const newStatus = statusSelect.value;
        console.log("Updating order", orderId, "to status:", newStatus);

        // Send a POST request to update the order status
        fetch("/cook/update-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ orderId: orderId, status: newStatus })
        })
            .then(res => res.json())
            .then(data => {
                console.log("Server response:", data);
                if (data.success) {
                    // Update the displayed status immediately
                    const statusText = document.getElementById(`status-text-${orderId}`);
                    statusText.textContent = newStatus;
                } else {
                    console.error("Update failed:", data.message);
                }
            })
            .catch(err => console.error("Error updating order:", err));
    }

    // Initial fetch and set refresh interval every 5 seconds
    fetchOrders();
    setInterval(fetchOrders, 5000);
});
