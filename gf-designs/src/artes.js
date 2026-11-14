document.querySelectorAll('.art').forEach(a=>{
  const light=a.classList.contains('light');
  if(a.dataset.photo){
    const img=document.createElement('img');img.className='bgimg';img.src='../fotos/'+a.dataset.photo+'.jpg';
    const sh=document.createElement('div');sh.className='shade '+(a.dataset.shade||'sb');
    a.prepend(sh);a.prepend(img);
  }
  if(!a.hasAttribute('data-nobrand')){
    const br=document.createElement('div');br.className='brand';
    const logo='<img src="logo-gf.svg" alt="GF">';
    br.innerHTML=(light?'<span class="chip">'+logo+'</span>':logo)+(a.hasAttribute('data-lock')?'<div class="lock"><b>GUINCHO FÁCIL</b><small>CONECTANDO QUEM TRANSPORTA</small></div>':'');
    const after=a.querySelector('.bgimg')?a.querySelector('.shade'):null;
    after?after.after(br):a.prepend(br);
  }
  if(a.dataset.n)a.insertAdjacentHTML('beforeend','<div class="count">'+a.dataset.n+'</div>');
  if(a.hasAttribute('data-arrow'))a.insertAdjacentHTML('beforeend','<div class="arrow">→</div>');
});
