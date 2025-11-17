import { useEffect, useRef, useState } from 'react';
import { Artist } from '../App';

interface MusicGraphProps {
  artists: Artist[];
}

interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  imageUrl: string;
  genre: string;
  image?: HTMLImageElement;
}

interface Link {
  source: string;
  target: string;
}

export function MusicGraph({ artists }: MusicGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [containerHeight, setContainerHeight] = useState(500); // 동적 높이

  const genreColors: { [key: string]: string } = {
    'J-Pop': '#1DB954',
    'K-Pop': '#1ed760',
    'K-Hip Hop': '#ff6b35',
    'K-R&B': '#ffbe0b',
    'Rock': '#8338ec',
    'Electronic': '#3a86ff',
    'Pop': '#ff006e',
    'Hip Hop': '#fb8500'
  };

useEffect(() => {
  if (!canvasRef.current) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const width = rect.width;
  const height = rect.height;

  // Create nodes with larger initial radius
  const maxPlayCount = Math.max(...artists.map(a => a.playCount));

  // 중심 노드 먼저 찾기
  const centerArtistData = artists.find(a => a.playCount === maxPlayCount);

  // 중심 노드가 아닌 노드들만 필터링
  const otherArtists = artists.filter(a => a.id !== centerArtistData?.id);

  // 장르별로 그룹화
  const genreGroups = otherArtists.reduce((groups, artist) => {
    if (!groups[artist.genre]) {
      groups[artist.genre] = [];
    }
    groups[artist.genre].push(artist);
    return groups;
  }, {} as Record<string, typeof otherArtists>);

  // 각 장르에 각도 범위 할당
  const genres = Object.keys(genreGroups);
  const anglePerGenre = (2 * Math.PI) / genres.length;

  // 초기 배치
  const tempNodes: Node[] = [];

  artists.forEach((artist) => {
    let x, y;

    // 중심 노드는 중앙에 배치
    if (artist.id === centerArtistData?.id) {
      x = width / 2;
      y = height / 2;
    } else {
      // 장르별 기준 각도 계산
      const genreIndex = genres.indexOf(artist.genre);
      const genreBaseAngle = genreIndex * anglePerGenre;

      // 같은 장르 내에서의 인덱스
      const artistsInGenre = genreGroups[artist.genre];
      const indexInGenre = artistsInGenre.findIndex(a => a.id === artist.id);

      // 같은 장르 내 노드들을 가까이 배치
      const angleSpread = anglePerGenre * 0.7;
      const angleOffset = (indexInGenre / artistsInGenre.length - 0.5) * angleSpread;
      const angle = genreBaseAngle + angleOffset;

      // 거리 계산: 노드 크기에 따라 조정
      const artistSize = (artist.playCount / maxPlayCount) * 40 + 20;
      const baseRadius = Math.min(width, height) * 0.35;

      // 큰 노드는 더 멀리, 작은 노드는 더 가까이
      const sizeMultiplier = 0.85 + (artistSize / 60) * 0.3;
      const radius = baseRadius * sizeMultiplier;

      x = width / 2 + Math.cos(angle) * radius;
      y = height / 2 + Math.sin(angle) * radius;
    }

    tempNodes.push({
      id: artist.id,
      name: artist.name,
      x,
      y,
      vx: 0,
      vy: 0,
      size: (artist.playCount / maxPlayCount) * 40 + 20,
      color: genreColors[artist.genre] || '#6c5ce7',
      imageUrl: artist.imageUrl,
      genre: artist.genre
    });
  });

  // 충돌 감지 및 위치 조정 (겹침 방지)
  const adjustPositions = (nodes: Node[], iterations: number = 50) => {
    for (let iter = 0; iter < iterations; iter++) {
      let hasOverlap = false;

      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        if (nodeA.id === centerArtistData?.id) continue; // 중심 노드는 고정

        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          if (nodeB.id === centerArtistData?.id) continue;

          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = nodeA.size + nodeB.size + 15; // 15px 여백

          if (distance < minDistance && distance > 0) {
            hasOverlap = true;

            // 겹친 경우 서로 밀어내기
            const overlap = minDistance - distance;
            const angle = Math.atan2(dy, dx);

            // 같은 장르면 적게, 다른 장르면 많이 밀어냄
            const pushStrength = nodeA.genre === nodeB.genre ? 0.5 : 0.6;

            nodeA.x -= Math.cos(angle) * overlap * pushStrength;
            nodeA.y -= Math.sin(angle) * overlap * pushStrength;
            nodeB.x += Math.cos(angle) * overlap * pushStrength;
            nodeB.y += Math.sin(angle) * overlap * pushStrength;
          }
        }
      }

      // 모든 노드가 겹치지 않으면 종료
      if (!hasOverlap) break;
    }

    return nodes;
  };

  nodesRef.current = adjustPositions(tempNodes);

  // 노드들의 bounding box 계산하여 컨테이너 높이 설정
  const calculateBoundingBox = (nodes: Node[]) => {
    if (nodes.length === 0) return { minY: 0, maxY: 500 };

    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      const nodeTop = node.y - node.size - 20; // 노드 크기 + 이름 텍스트 공간
      const nodeBottom = node.y + node.size + 20; // 여유 공간

      minY = Math.min(minY, nodeTop);
      maxY = Math.max(maxY, nodeBottom);
    });

    return { minY, maxY };
  };

  const { minY, maxY } = calculateBoundingBox(nodesRef.current);
  const calculatedHeight = Math.max(500, maxY - minY + 80); // 최소 500px, 상하 여백 80px
  setContainerHeight(calculatedHeight);

  // Load images
  let loadedCount = 0;
  nodesRef.current.forEach(node => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      node.image = img;
      loadedCount++;
      if (loadedCount === nodesRef.current.length) {
        setImagesLoaded(true);
      }
    };
    img.onerror = () => {
      loadedCount++;
      if (loadedCount === nodesRef.current.length) {
        setImagesLoaded(true);
      }
    };
    img.src = node.imageUrl;
  });

  // Create links - 중심 노드와만 연결 (Star/Hub topology)
  linksRef.current = [];

  // 가장 큰 노드(중심) 찾기
  const centerArtist = artists.find(a => a.playCount === maxPlayCount);

  if (centerArtist) {
    // 중심 노드와 모든 다른 노드만 연결 (노드끼리는 연결 안함)
    artists.forEach(artist => {
      if (artist.id !== centerArtist.id) {
        linksRef.current.push({
          source: centerArtist.id,
          target: artist.id
        });
      }
    });
  }

  const simulate = () => {
    const nodes = nodesRef.current;
    const links = linksRef.current;

    // Draw
    ctx.clearRect(0, 0, width, height);

    // Draw links (모두 중심 노드와의 연결)
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = '#606060';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      // Node circle (border)
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw image if loaded
      if (node.image) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size - 4, 0, 2 * Math.PI);
        ctx.clip();
        
        const imgSize = (node.size - 4) * 2;
        ctx.drawImage(
          node.image,
          node.x - imgSize / 2,
          node.y - imgSize / 2,
          imgSize,
          imgSize
        );
        ctx.restore();
      } else {
        // Fallback: draw text if image not loaded
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let displayName = node.name;
        if (displayName.length > 10) {
          displayName = displayName.substring(0, 10) + '...';
        }
        
        ctx.fillText(displayName, node.x, node.y);
      }

      // Artist name below node
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      let displayName = node.name;
      if (displayName.length > 12) {
        displayName = displayName.substring(0, 12) + '...';
      }
      
      ctx.fillText(displayName, node.x, node.y + node.size + 5);
    });

    animationRef.current = requestAnimationFrame(simulate);
  };

  simulate();

  // Mouse interaction
  const handleMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    const hoveredNode = nodesRef.current.find(node => {
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= node.size;
    });

    setHoveredNode(hoveredNode || null);
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  };

  canvas.addEventListener('mousemove', handleMouseMove);

  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    canvas.removeEventListener('mousemove', handleMouseMove);
  };
}, [artists]);

  return (
    <div
      className="relative w-full"
      style={{ height: `${containerHeight}px` }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        style={{ background: 'linear-gradient(135deg, #121212 0%, #181818 100%)' }}
      />
      
      {hoveredNode && (
        <div 
          className="absolute bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl z-10 pointer-events-none"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y - 10,
            transform: 'translate(0, -100%)'
          }}
        >
          <div className="flex items-center gap-3">
            <img 
              src={hoveredNode.imageUrl} 
              alt={hoveredNode.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="text-white font-semibold">{hoveredNode.name}</p>
              <p className="text-gray-300">{hoveredNode.genre}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 text-sm text-gray-400">
        Node size represents play count • Lines connect to the central artist
      </div>
    </div>
  );
}