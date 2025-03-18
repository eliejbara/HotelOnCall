async function getResponse() {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Hello" })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        document.getElementById("response").innerText = data.generated_text || "No response";
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("response").innerText = "Error fetching response";
    }
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("chatButton").addEventListener("click", getResponse);
});
