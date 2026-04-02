// Initialisation : Configure le canvas, le contexte 2D, les dimensions, les éléments DOM pour les contrôles (vitesse et direction), et définit l'objet bike avec position, angle et empattement.
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const speedInput = document.getElementById("speed");
const steeringInput = document.getElementById("steering");
const speedValue = document.getElementById("speedValue");
const steeringValue = document.getElementById("steeringValue");
const scoreValue = document.getElementById("scoreValue");
let bike = {
  x: 0,
  y: 0,
  angle: 0,
  wheelBase: 60,
};
let bpm = 0;
const heart = document.querySelector(".heart");
const bpmValue = document.querySelector("#bpm-value");

// Test animation coeur en appuyant sur une touche
document.addEventListener("keypress", () => {
  heart.classList.add("heart-animation");

  // Ajout de la classe pour déclencher l'animation
  setTimeout(() => {
    heart.classList.remove("heart-animation");
  }, 600);
});

// Chargement des images
const images = {
  arbre: new Image(),
  rocher: new Image(),
  pieton: new Image(),
  piece: new Image()
};

images.arbre.src = 'img/arbre.png';
images.rocher.src = 'img/rocher.png';
images.pieton.src = 'img/pieton.png';
images.piece.src = 'img/piece.png';

const obstacleTypes = ['arbre', 'rocher', 'pieton'];

let obstacles = [];
let bonuses = [];
let score = 0;
let crashed = false;
let generatedChunks = new Set();
const chunkSize = 500;

// Connexion WebSocket pour recevoir les mises à jour de vitesse
const ws = new WebSocket("ws://192.168.0.227:1880/ws/speed");
ws.onopen = function () {
  console.log("Connecté au WebSocket pour la vitesse");
};
ws.onmessage = function (event) {
  console.log("Message WebSocket reçu:", event.data);
  try {
    const data = JSON.parse(event.data);
    if (data.speed !== undefined) {
      speedInput.value = data.speed;
      console.log("Vitesse mise à jour à:", data.speed);
    } else {
      console.warn("Message sans champ 'speed':", data);
    }
  } catch (e) {
    // Si ce n'est pas JSON, traiter comme valeur numérique directe
    const speed = parseFloat(event.data);
    if (!isNaN(speed)) {
      speedInput.value = speed;
      console.log("Vitesse mise à jour à (valeur directe):", speed);
    } else {
      console.error("Message non reconnu:", event.data);
    }
  }
};
ws.onerror = function (error) {
  console.error("Erreur WebSocket:", error);
};
ws.onclose = function () {
  console.log("Connexion WebSocket fermée");
};

// Connexion WebSocket pour recevoir les mises à jour d'angle
const wsAngle = new WebSocket("ws://192.168.0.227:1880/ws/angle");
wsAngle.onopen = function () {
  console.log("Connecté au WebSocket pour l'angle");
};
wsAngle.onmessage = function (event) {
  console.log("Message WebSocket angle reçu:", event.data);
  try {
    const data = JSON.parse(event.data);
    if (data !== undefined) {
      steeringInput.value = data;
      console.log("Angle mis à jour à:", data);
    } else {
      console.warn("Message sans champ 'angle':", data);
    }
  } catch (e) {
    // Si ce n'est pas JSON, traiter comme valeur numérique directe
    const angle = parseFloat(event.data);
    if (!isNaN(angle)) {
      steeringInput.value = angle;
      console.log("Angle mis à jour à (valeur directe):", angle);
    } else {
      console.error("Message angle non reconnu:", event.data);
    }
  }
};
wsAngle.onerror = function (error) {
  console.error("Erreur WebSocket angle:", error);
};
wsAngle.onclose = function () {
  console.log("Connexion WebSocket angle fermée");
};

// Connexion WebSocket pour recevoir le BPM
const wsBpm = new WebSocket("ws://192.168.0.227:1880/ws/bpm");
wsBpm.onopen = function () {
  console.log("Connecté au WebSocket pour le pouls");
};
wsBpm.onmessage = function (event) {
  console.log("Message WebSocket reçu:", event.data);
  try {
    const data = JSON.parse(event.data);
    if (data !== undefined) {
      bpm = data;
      // Affichage valeur BPM reçue
      bpmValue.textContent = data;

      console.log("BPM vaut :", data);

      // Ajout de la classe pour déclencher l'animation
      heart.classList.add("heart-animation");

      // Suppression de la classe dès que l'animation est terminée
      setTimeout(() => {
        heart.classList.remove("heart-animation");
      }, 600);
    } else {
      console.warn("Payload vide : ", data);
    }
  } catch (e) {
    // Si ce n'est pas JSON, traiter comme valeur numérique directe
    // const speed = parseFloat(event.data);
    // if (!isNaN(speed)) {
    //   speedInput.value = speed;
    //   console.log("Vitesse mise à jour à (valeur directe):", speed);
    // } else {
    //   console.error("Message non reconnu:", event.data);
    // }
  }
};
wsBpm.onerror = function (error) {
  console.error("Erreur WebSocket:", error);
};
wsBpm.onclose = function () {
  console.log("Connexion WebSocket fermée");
};


// checkCollisions() : Vérifie les collisions entre le vélo et les obstacles, ainsi que la collecte des bonus. En cas de collision, pénalise le score, repousse le vélo et gère l'état de crash pour éviter les collisions répétées.
function checkCollisions() {
  const bikeRadius = 15;

  for (let obs of obstacles) {
    const dx = bike.x - obs.x;
    const dy = bike.y - obs.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < bikeRadius + obs.radius) {
      score -= 10;
      const angle = Math.atan2(dy, dx);
      bike.x += Math.cos(angle) * 50;
      crashed = true;
      speedInput.value = 0;

      setTimeout(() => {
        crashed = false;
      }, 1000); // 1 seconde

      return;
    }
  }

  // Bonus inchangé
  bonuses.forEach((b) => {
    if (!b.active) return;

    const dx = bike.x - b.x;
    const dy = bike.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < bikeRadius + b.radius) {
      score += 5;
      b.active = false;
    }
  });
}

// update() : Met à jour la position et l'angle du vélo en fonction des valeurs de vitesse et de direction saisies. Calcule le rayon de virage et la vitesse angulaire pour simuler les mouvements réalistes du vélo.
function update() {
  scoreValue.textContent = score;
  let speed = parseFloat(speedInput.value);
  speed *= 3.6;
  if(speed !== 0)
  {
    speed = parseFloat(speed).toFixed(2);
  }
  const steeringDeg = parseFloat(steeringInput.value);
  const steering = (steeringDeg * Math.PI) / 180;
  speedValue.textContent = speed;
  steeringValue.textContent = steeringDeg;
  if (Math.abs(steering) > 0.001) {
    const turningRadius = bike.wheelBase / Math.tan(steering);
    const angularVelocity = speed / turningRadius;
    bike.angle += angularVelocity;
  }
  bike.x += speed * Math.cos(bike.angle);
  bike.y += speed * Math.sin(bike.angle);
  updateChunks();
  checkCollisions();
}

function generateChunk(cx, cy) {
  const key = `${cx},${cy}`;
  if (generatedChunks.has(key)) return;
  generatedChunks.add(key);

  const margin = 100;

  // 30% de chance d'avoir un obstacle par chunk
  if (Math.random() < 0.5) {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push({
      x: cx * chunkSize + margin + Math.random() * (chunkSize - margin * 2),
      y: cy * chunkSize + margin + Math.random() * (chunkSize - margin * 2),
      radius: 25,
      type: type
    });
  }

  // 20% de chance d'avoir un bonus par chunk
  if (Math.random() < 0.3) {
    bonuses.push({
      x: cx * chunkSize + margin + Math.random() * (chunkSize - margin * 2),
      y: cy * chunkSize + margin + Math.random() * (chunkSize - margin * 2),
      radius: 15,
      active: true,
    });
  }
}

function updateChunks() {
  const cx = Math.floor(bike.x / chunkSize);
  const cy = Math.floor(bike.y / chunkSize);

  // Génère autour du joueur
  for (let dx = 0; dx <= 1; dx++) {
  for (let dy = 0; dy <= 1; dy++) {
      generateChunk(cx + dx, cy + dy);
    }
  }
}
// drawWorld() : Dessine l'environnement : un fond vert et une grille infinie répétitive, centrée sur la position du vélo pour créer un effet de monde ouvert.
function drawWorld() {
  const gridSize = 50;
  // Fond vert
  ctx.fillStyle = "#4CAF50";
  ctx.fillRect(
    bike.x - canvas.width / 2 - 1000,
    bike.y - canvas.height / 2 - 1000,
    canvas.width + 2000,
    canvas.height + 2000,
  );
  // Grille répétitive infinie
  ctx.strokeStyle = "#3e8e41";
  ctx.lineWidth = 1;
  let startX = Math.floor((bike.x - canvas.width / 2) / gridSize) * gridSize;
  let endX = bike.x + canvas.width / 2;
  let startY = Math.floor((bike.y - canvas.height / 2) / gridSize) * gridSize;
  let endY = bike.y + canvas.height / 2;
  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  // // Route répétitive horizontale
  // ctx.fillStyle = "#555";
  // for (let y = startY; y < endY; y += 800) {
  //   ctx.fillRect(startX - 1000, y + 300, canvas.width + 2000, 200);
  // }
}
// drawBike() : Dessine le vélo sur le canvas : le cadre rouge, les roues noires, en tenant compte de l'angle du vélo et de la direction des roues avant pour une visualisation réaliste.
function drawBike() {
  ctx.save();
  // Caméra : on centre le vélo
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(bike.angle);
  // Cadre
  ctx.fillStyle = "red";
  ctx.fillRect(-30, -10, 60, 20);
  // Roue arrière
  ctx.fillStyle = "black";
  ctx.fillRect(-35, -5, 30, 10);
  // Roue avant
  ctx.save();
  ctx.translate(20, 0);
  ctx.rotate((parseFloat(steeringInput.value) * Math.PI) / 180);
  ctx.fillRect(-5, -5, 30, 10);
  ctx.restore();
  ctx.restore();
}

function drawObjects() {
  // Dessin des obstacles
  obstacles.forEach((obs) => {
    const img = images[obs.type];
    const size = obs.type === 'pieton' ? obs.radius * 2.5 : obs.radius * 4.5; // ← taille normale pour les piétons
    ctx.drawImage(img, obs.x - size/2, obs.y - size/2, size, size);
  });

  // Dessin des pièces
  bonuses.forEach((b) => {
    if (b.active) {
      const size = b.radius * 3.5;
      ctx.drawImage(images.piece, b.x - b.radius, b.y - b.radius, size, size);
    }
  });
}

// loop() : Boucle d'animation principale qui appelle update(), dessine le monde et le vélo, puis utilise requestAnimationFrame pour répéter le cycle à chaque frame, créant l'animation fluide.
function loop() {
  update();
  ctx.save();
  // Caméra suit le vélo
  ctx.translate(canvas.width / 2 - bike.x, canvas.height / 2 - bike.y);
  drawWorld();
  drawObjects();
  ctx.restore();
  drawBike();
  requestAnimationFrame(loop);
}
loop();




