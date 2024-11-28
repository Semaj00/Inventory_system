<?php
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "inventory_system";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully";

$username = $_POST['username'];
$password = $_POST['password'];

// Prepare and bind
$stmt = $conn->prepare("INSERT INTO login (username, password) VALUES (?, ?)");
if ($stmt === false) {
    die("Prepare failed: " . $conn->error);
}

$stmt->bind_param("ss", $username, $password);

// Execute the statement
if ($stmt->execute()) {
    echo "Data Inserted";
} else {
    echo "Data Not Inserted: " . $stmt->error;
}

// Close the statement and connection
$stmt->close();
$conn->close();
?>