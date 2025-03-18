async function getResponse(userMessage) {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
            throw new Error("Error with API request");
        }

        const data = await response.json();
        return data.generated_text || "Sorry, I didn't understand that.";
    } catch (error) {
        console.error("Error getting response:", error);
        return "Something went wrong. Please try again.";
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const chatInput = document.getElementById("chatInput");
    const chatSubmit = document.getElementById("chatSubmit");
    const chatOutput = document.getElementById("chatOutput");

    chatSubmit.addEventListener("click", async function () {
        const userMessage = chatInput.value;
        if (userMessage.trim() === "") return;
        const botResponse = await getResponse(userMessage);
        chatOutput.innerHTML = `<p><strong>You:</strong> ${userMessage}</p><p><strong>AI:</strong> ${botResponse}</p>`;
        chatInput.value = "";
    });
});
