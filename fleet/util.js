export async function transition(node, name) {
    node.classList.add(name);
    await new Promise(resolve => node.addEventListener("transitionend", resolve, {once: true}));
}

export async function animate(node, name) {
    await transition(node, name);
    node.classList.remove(name);
}

export async function animate2(node, name) {
    node.style.animationName = name;
    await new Promise(resolve => node.addEventListener("animationend", resolve, {once: true}));
    node.style.animationName = "";
}
