document.addEventListener("DOMContentLoaded", () => {
    const ordersContainer = document.getElementById("orders-container");

    // Fetch orders from the server
    function fetchOrders() {
        fetch("/cook/orders")
            .then(res => res.json())
            .then(data => {
                console.log("✅ Orders received:", data);
                ordersContainer.innerHTML = "";
                data.forEach(order => {
                    const orderBox = document.createElement("div");
                    orderBox.className = "order-box";
                    orderBox.innerHTML = `
                        <p><b>Order ID:</b> ${order.id}</p>
                        <p><b>User:</b> ${order.guest_email}</p>
                        <p><b>Food:</b> ${order.menu_item} x${order.quantity}</p>
                        <p><b>Status:</b> ${order.order_status}</p>
                        <select id="status-${order.id}">
                            <option value="Pending" ${order.order_status === "Pending" ? "selected" : ""}>Pending</option>
                            <option value="In Progress" ${order.order_status === "In Progress" ? "selected" : ""}>In Progress</option>
                            <option value="Completed" ${order.order_status === "Completed" ? "selected" : ""}>Completed</option>
                        </select>
                        <button id="updateBtn-${order.id}">Update</button>
                    `;
                    ordersContainer.appendChild(orderBox);

                    // Add event listener to the update button
                    const updateBtn = document.getElementById(`updateBtn-${order.id}`);
                    updateBtn.addEventListener("click", () => updateOrder(order.id));
                });
            })
            .catch(err => console.error("Error fetching orders:", err));
    }

    // Update order status
    function updateOrder(orderId) {
        const status = document.getElementById(`status-${orderId}`).value;

        fetch("/cook/update-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, status })
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                console.log("Order updated successfully", result);
                fetchOrders();  // Refresh the orders after updating
            } else {
                console.error("Error:", result.message);
            }
        })
        .catch(err => console.error("Error updating order:", err));
    }

    fetchOrders();
    setInterval(fetchOrders, 5001); // Refresh orders every 5 seconds
});