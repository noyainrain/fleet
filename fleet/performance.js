/* TODO. */

/** TODO. */

import {Body} from "./simulation.js?x";
import {createSVGElement} from "./util.js";

addEventListener("DOMContentLoaded", () => {
    const world = document.querySelector("fleet-world");

    /*let bodies = new Array(128).fill(null);
    bodies = bodies.map(() => {
        // const node = createSVGElement("circle", {r: 2});
        const node = document.createElement("div");
        node.style.width = `${4 * 10}px`;
        node.style.height = `${4 * 10}px`;
        node.style.background = "black";
        node.style.borderRadius = "10px";
        const body = new Body(null, 0, node);
        body.update(
            new DOMPoint((Math.random() - 0.5) * world.size, (Math.random() - 0.5) * world.size),
            0
            // Math.random() * 2 * Math.PI
        );
        const angle = Math.random() * 2 * Math.PI;
        const v = Math.random() * 20 * 10;
        body.velocity = new DOMPoint(Math.cos(angle) * v, Math.sin(angle) * v);
        // XXX
        //body.node.style.transform =
        //    `translate(${body.position.x}px, ${body.position.y}px) rotate(${body.orientation}rad)`;
        return body;
    });
    world.add(...bodies);*/

    const PPM = 14;
    let url;
    const canvas = document.createElement("canvas");
    canvas.width = 2 * PPM * window.devicePixelRatio;
    canvas.height = 2 * PPM * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");

    /*ctx.fillStyle = "#ccc";
    ctx.beginPath();
    ctx.arc(PPM, PPM, PPM, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = "hsl(0, 100%, 50%)";
    ctx.lineWidth = 0.25 * PPM;
    ctx.beginPath();
    ctx.arc(PPM, PPM, 0.75 * PPM - PPM / 8, Math.PI / 4, 3 * Math.PI / 4);
    ctx.stroke();*/

    ctx.scale(PPM * window.devicePixelRatio, PPM * window.devicePixelRatio);

    ctx.fillStyle = "#ccc";
    ctx.beginPath();
    ctx.arc(1, 1, 1, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = "hsl(0, 100%, 60%)";
    // ctx.filter = "blur(0.33px)";
    ctx.lineWidth = 1 / PPM;
    ctx.beginPath();
    ctx.arc(1, 1, 0.75, Math.PI / 4, 3 * Math.PI / 4);
    ctx.stroke();

    // ctx.fillRect(0, 0, 40, 40);
    canvas.toBlob(blob => {
        url = URL.createObjectURL(blob);
    });

    const moveInput = document.querySelector("[value=move]");

    function generateBodies(n) {
        let bodies = new Array(n).fill(null);
        bodies = bodies.map(() => {
            // will-change: transform: impacts performance on chrome (not ff) (negative on android)

            //const node = document.createElement("div");
            //node.style.width = `${4 * 10}px`;
            //node.style.height = `${4 * 10}px`;
            //node.style.background = "black";
            //node.style.borderRadius = "10px"; // <- on/off impacts performance

            const node = document.createElement("img");
            //node.width = 100;
            //node.height = 100;
            //node.src = "./fleet.png";
            node.width = 2 * PPM;
            node.height = 2 * PPM;
            node.src = url;

            //const node = document.createElement("div");
            //let img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);
            //img = document.createElement("img");
            //img.width = 40;
            //img.height = 40;
            //img.src = "./fleet.png";
            //node.append(img);

            //const node = createSVGElement("rect", {x: -2, y: -2, width: 4, height: 4, rx: 1});

            //const node = document.createElement("div");
            //node.style.width = `${4 * 10}px`;
            //node.style.height = `${4 * 10}px`;
            //const svg = createSVGElement("svg");
            //svg.style.width = "100%";
            //svg.style.height = "100%";
            //svg.setAttribute("viewBox", "-2 -2 4 4");
            //const rect = createSVGElement("rect", {x: -2, y: -2, width: 4, height: 4, rx: 1});
            //svg.append(rect);
            //node.append(svg);

            //const node = createSVGElement("svg");
            //node.style.width = `${4 * 10}px`;
            //node.style.height = `${4 * 10}px`;
            //node.setAttribute("viewBox", "-2 -2 4 4");
            //const rect = createSVGElement("rect", {x: -2, y: -2, width: 4, height: 4, rx: 1});
            //node.append(rect);

            // TODO:
            //const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${this.#stars.innerHTML}</svg>`;
            // node.style.background = `url("data:image/svg+xml,${encodeURIComponent(data)}")`;

            //const node = createSVGElement("rect", {x: -2, y: -2, width: 4, height: 4, rx: 1});

            // node.style.opacity = 0.5; // <- no change
            node.style.opacity = 0.5 * Math.random() + 0.5; // <- no change

            const body = new Body(null, 0, node);
            body.update(
                new DOMPoint((Math.random() - 0.5) * world.size, (Math.random() - 0.5) * world.size),
                0
                // Math.random() * 2 * Math.PI
            );
            if (moveInput.checked) {
                const angle = Math.random() * 2 * Math.PI;
                // const v = Math.random() * 20;
                const v = Math.random() * 20 * 10;
                body.velocity = new DOMPoint(Math.cos(angle) * v, Math.sin(angle) * v);
                body.spin = 2 * Math.PI * Math.random() - Math.PI;
            }
            // XXX
            //body.node.style.transform =
            //    `translate(${body.position.x}px, ${body.position.y}px) rotate(${body.orientation}rad)`;
            return body;
        });
        return bodies;
    }

    const GUESS = 128;
    // world.add(...generateBodies(GUESS));

    let angle = 0;

    const infoP = document.querySelector("#info p");
    let even = true;

    const cameraInput = document.querySelector("[value=camera]");

    //let grow = true;
    /*if (grow) {
        correction = 1;
        grow = false;
    } else {
        correction = correction * 2;
    }*/
    /*if (!grow) {
        correction = 1
        grow = true;
    } else {
        correction = correction * 2;
    }*/
    world.addEventListener("tick", event => {
        const t = event.detail.t;

        if (cameraInput.checked) {
            world.updateCamera(new DOMPoint(), world.camera.orientation + Math.PI / 16 * t);
        }

        //angle = (angle + Math.PI / 4 * t) % (2 * Math.PI);
        //const r = 16;
        //world.updateCamera(new DOMPoint(r * Math.cos(angle), r * Math.sin(angle)), 0);

        const w = world.size / 2 + 2;
        for (let body of world.bodies) {
            if (body.position.x < -w) {
                body.update(new DOMPoint(w, body.position.y), body.orientation);
            } else if (body.position.x > w) {
                body.update(new DOMPoint(-w, body.position.y), body.orientation);
            }
            if (body.position.y < -w) {
                body.update(new DOMPoint(body.position.x, w), body.orientation);
            } else if (body.position.y > w) {
                body.update(new DOMPoint(body.position.x, -w), body.orientation);
            }
        }

        // world.updateCamera(new DOMPoint(r * Math.cos(angle), r * Math.sin(angle)), angle);
        // world.updateCamera(new DOMPoint(), angle);

        infoP.textContent = `${world.bodies.size} n @ ${world.frameRate} FPS`;
        // infoP.style.background = even ? "black" : "white";
        even = !even;
    });

    // let growth = GUESS / 4;
    let growth = 64;
    setInterval(() => {
        if (world.frameRate >= 60) {
            if (growth < 0) {
                growth = Math.max(-growth / 2, 1);
            }
            console.log("growth", growth);
            world.add(...generateBodies(growth));
        } else if (world.frameRate < 54 && world.bodies.size > 1) {
            if (growth > 0) {
                growth = Math.min(-growth / 2, -1);
            }
            console.log("growth", growth);
            world.remove(...[...world.bodies].slice(1, -growth + 1));
        } else {
            console.log("stable");
        }
    }, 1000);

    function reset() {
        growth = 64;
        world.reset();
        world.gpu = form.elements.features[0].checked;
        if (form.elements.features[1].checked) {
            const div = document.createElement("div");
            div.style.width = `${document.documentElement.clientWidth}px`;
            div.style.height = `${document.documentElement.clientHeight}px`;
            console.log("X", document.documentElement.clientWidth);
            div.style.background = "radial-gradient(closest-side, purple, black)";
            const body = new Body(null, 0, div);
            if (moveInput.checked) {
                body.spin = -Math.PI / 16;
            }
            world.add(body);
        }
    }

    const form = document.querySelector("#info form");
    form.addEventListener("change", reset);
    reset();
});
