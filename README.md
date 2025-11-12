#Wild West Forum

**COS498- Fall 2025 Midterm Project**

<h1>Overview</h1>
This is an intentionally insecure web forum built with **Node.js**, **Express**, **Handlebars**, and **Nginx**, 
containerized using **Docker** and managed with **docker-compose**.

It allows users to register, log in/log out, and post comments, all stored in simple **in-memory arrays**.
This project includes a **Public Git Repository** with meaningful commit history.
______________________________________________________________________

<h2>How to Run the Project</h2>

###1. Clone the Repository
git clone git@github.com:paigem52/Midterm-Project-COS498.git

###2. Navigate into the cloned repository
cd Midterm-Project-COS498

###3. Build and Run the Containers
docker compose build
docker compose up

This will build both the Node.js and Nginx containers

###4. Access the Website
Once the containers are running, open your browser and go to:
http://157.245.118.26/

The homepage should show navigation links for Register, Login, Comment Feed, and New Comment. 
Only logged in users will be able to add a comment- guest users will be redirected to the login page.

###5. Stopping the Containers
When finished testing:
docker compose down







