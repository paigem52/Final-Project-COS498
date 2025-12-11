<h1>Wild West Forum</h1>

<h1>**COS498- Fall 2025 Midterm Project**</h1>

<h2>Overview</h2>
This is an intentionally insecure web forum built with **Node.js**, **Express**, **Handlebars**, and **Nginx**, 
containerized using **Docker** and managed with **docker-compose**.

It allows users to register, log in/log out, and post comments, all stored in simple **in-memory arrays**.
This project includes a **Public Git Repository** with meaningful commit history.
______________________________________________________________________

<h2>How to Run the Project</h2>

In your terminal:
<h3>1. Clone the Repository</h3>
git clone git@github.com:paigem52/Midterm-Project-COS498.git

<h3>2. Navigate into the cloned repository</h3>
cd Midterm-Project-COS498

<h3>3. Build and Run the Containers</h3>
docker compose build <br>
docker compose up <br>

<br> This will build both the Node.js and Nginx containers.

<h3>4. Access the Website</h3>
Once the containers are running, open your browser and go to: <br>
http://157.245.118.26/

<br> The homepage should show navigation links for Register, Login, Comment Feed, and New Comment. <br>
Only logged in users will be able to add a comment- guest users will be redirected to the login page.

<h3>5. Stopping the Containers</h3>
When finished testing: <br>
docker compose down







Initial commit of final project based on midterm
