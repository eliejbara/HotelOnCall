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
                ordersContainer.innerHTML = "";
                ordersContainer.innerHTML = ""; // Clear the current orders

                data.forEach(order => {
                    const orderBox = document.createElement("div");
                    orderBox.className = "order-box";
                    orderBox.innerHTML = `
                        <p><b>Order ID:</b> ${order.id}</p>
                        <p><b>User:</b> ${order.guest_email}</p>
                        <p><b>Food:</b> ${order.menu_item} x${order.quantity}</p>
                        <p><b>Status:</b> ${order.order_status}</p>
                        <p><b>Status:</b> <span id="status-text-${order.id}">${order.order_status}</span></p>
                        <select id="status-${order.id}">
                            <option value="Pending" ${order.order_status === "Pending" ? "selected" : ""}>Pending</option>
                            <option value="In Progress" ${order.order_status === "In Progress" ? "selected" : ""}>In Progress</option>
@@ -25,6 +29,17 @@
                    `;
                    ordersContainer.appendChild(orderBox);

                    // If the status was changed previously, apply the cached value
                    const statusSelect = document.getElementById(`status-${order.id}`);
                    if (statusCache[order.id]) {
                        statusSelect.value = statusCache[order.id];
                    }

                    // Add event listener to track status changes before clicking 'Update'
                    statusSelect.addEventListener("change", () => {
                        statusCache[order.id] = statusSelect.value; // Cache the new selected value
                    });

                    // Add event listener to the update button
                    const updateBtn = document.getElementById(`updateBtn-${order.id}`);
                    updateBtn.addEventListener("click", () => updateOrder(order.id));
@@ -54,6 +69,9 @@
        .catch(err => console.error("Error updating order:", err));
    }

    // Initial fetch
    fetchOrders();
    setInterval(fetchOrders, 5000); // Refresh orders every 5 seconds
});
});
