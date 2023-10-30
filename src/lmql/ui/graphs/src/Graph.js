import React, { useEffect } from 'react';
import "./App.css"

import Cytoscape from 'cytoscape';
import * as dagre from 'cytoscape-dagre';
import { graph } from './connection';
import cytoscape from 'cytoscape';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs';

Cytoscape.use(dagre);

// different colors to use for different value_class_id values
const VALUE_CLASS_COLORS = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf'
];

const cyStyle = [
    {
      selector: 'node',
      style: {
        // light grey
        'width': 'label',
        'font-family': 'monospace',
        'padding': '5px',
        'label': 'data(label)',
        'font-size': 8,
        'shape': 'ellipse',
        'width': '10px',
        'height': '10px',
        'background-color': 'grey',
      }
    },
    {
        selector: 'node[composite]',
        style: {
            'background-color': '#efefef',
            'text-valign': 'top',
            'shape': 'roundrectangle',
            'text-halign': 'center',
            'text-margin-y': '7.5px',
            'color': 'grey',
            'font-size': 6,
            // padding for composite nodes
            'padding-top': '30px',
            'padding-bottom': '10px',
            'padding-left': '10px',
            'padding-right': '10px',
        }
    },
    {
        selector: 'edge',
        style: {
          'width': 1,
          'target-arrow-shape': 'triangle',
          'line-color': 'grey',
          'target-arrow-color': 'grey',
          "curve-style": "bezier",
          "control-point-step-size": 40,
          'label': 'data(label)',
          'font-size': 10,
          'color': '#999999',
          // line endings
          'source-endpoint': 'inside-to-node',
          'target-endpoint': 'outside-to-node'
        }
    },
    {
      selector: 'edge[meta]',
      style: {
        'width': 20,
        'target-arrow-shape': 'triangle',
        'line-color': 'grey',
        'target-arrow-color': 'grey',
        'opacity': 0.1,
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-size': 10,
        'color': '#999999',
        // line endings
        'source-endpoint': 'inside-to-node',
        'target-endpoint': 'outside-to-node'
      }
    },
    // selected node
    {
        selector: 'node:selected',
        style: {
            'border-width': 1,
            // very dark grey
            'border-color': '#333333',
        }
    }
  ];

function diffElement(a, b) {
    console.log("compare", a, b)
    if (a && b && a.id && b.id) {
        return a.id != b.id;
    }
    return a !== b;
}

// tree dag
const layout = {
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 20,
    edgeSep: 10,
    rankSep: 40,
    minLen: 1,
    fit: true,
    padding: 130,
    spacingFactor: 1.5,
    animate: false,
    animationDuration: 500,
    animationEasing: 'ease-in-out',
    boundingBox: undefined,
    tilingPaddingVertical: 10,
    tilingPaddingHorizontal: 10,
    tilingPaddingLeft: 10,
    tilingPaddingRight: 10,
    tilingPaddingTop: 10,
    tilingPaddingBottom: 10,
    gravity: undefined,
    numIter: 1000,
    tile: true,
    tilePadding: 10,
    animateFilter: function (node, i) {
        return true;
    },
    ready: function () { },
    stop: function () { }
};

function ChildData(props) {
    let children = props.children;
    children.sort((a, b) => {
        return a.score - b.score;
    })

    props.expandable = (props.expandable && children.length > 0);

    const [expanded, setExpanded] = React.useState(!props.expandable);

    return <div className='child-data'>
        {(props.expandable && children.length > 0) && <div className='child-data-header' onClick={() => setExpanded(!expanded)}>
                {expanded ? '▼' : '▶'} {children.length} children
        </div>}
        {(expanded || !props.expandable) && props.children.map(child => {
                return <div key={child.id} style={{marginLeft: (props.indent || 0) * 10}}>
                    <NodeData node={child} label={child.label} indent={(props.indent || -1) + 1}/>
                </div>
            }
        )}
    </div>
}

function NodeData(props) {
    if (!props.node) {
        return null;
    }

    return <div class={'node-data' + (props.indent > 0 ? ' child' : '')} style={{borderColor: props.node.color}}>
        {props.label && <h4>{props.label}</h4>}
        <div className='score value'>Score: <code>{props.node.score}</code></div>
        <SyntaxHighlighter language="json" style={atomOneDarkReasonable} wrapLongLines={true}>
            {JSON.stringify(props.node.result, null, 2)}
        </SyntaxHighlighter>
        <ChildData expandable={true} indent={(props.indent || 0) + 1} children={props.node.children.map(c => c.data)}/>
    </div>
}

function LMQLCode(props) {
    return <SyntaxHighlighter 
            language="python" 
            wrapLongLines={true} 
            style={atomOneDarkReasonable}
            
        >
        {props.children}
    </SyntaxHighlighter>
}

export function Graph() {
    const cy = React.useRef(null);
    const [activeNode, setActiveNode] = React.useState(null);

    let child_data = null;

    if (activeNode && activeNode.composite) {
        // find children
        let children = cy.current.cy.$(`[parent="${activeNode.id}"]`);
        child_data = children.map(child => child.data());
    }

    React.useEffect(() => {
        if (cy.current) {
            let root = cy.current;
            if (root.innerHTML != "") {
                return;
            }
            let cy_instance = cytoscape({
                container: root,
                elements: [],
                style: cyStyle,
                zoom: 0.5,
                minZoom: 0.1,
                maxZoom: 4,
                layoutPadding: 20
            });
            cy.current.cy = cy_instance;

            cy.current.cy.on('tap', 'node', function (evt) {
                var node = evt.target;
                setActiveNode(node.data());
            })
        }
    }, [cy]);

    useEffect(() => {
        const onData = (elements) => {
            if (cy.current && elements) {
                let cy_instance = cy.current.cy;
                if (cy_instance) {
                    let node_pos = {}
                    cy_instance.nodes().forEach(node => {
                        node_pos[node.id()] = node.position();
                    })

                    let pan = cy_instance.pan();
                    let zoom = cy_instance.zoom();

                    console.log(pan, zoom)
    
                    cy_instance.elements().remove();
                    cy_instance.add(elements);

                    // for each node, assign 'color' based on VALUE_CLASS_COLORS and value_class_id (with modulo)
                    cy_instance.nodes().forEach(node => {
                        let color = VALUE_CLASS_COLORS[node.data().value_class_id % VALUE_CLASS_COLORS.length];
                        node.style('background-color', color);
                        node.data('color', color);
                    })

                    cy_instance.layout(layout).run();
    
                    cy_instance.nodes().forEach(node => {
                        let props = node_pos[node.id()];
                        node.position(props);
                    })

                    if (!activeNode) {
                        setActiveNode(cy_instance.nodes()[0].data());
                    }

                    if (pan.x != 0 || pan.y != 0) {
                        cy_instance.pan(pan);
                    }
                    if (zoom != 0.5) {
                        cy_instance.zoom(zoom);
                    }
                }
            }
        };
        graph("test.json").addDataListener(onData);
        return () => {
            graph("test.json").removeDataListener(onData);
        }
    }, []);

    return <>
        <div className='inspector'>
            <h2>{activeNode && activeNode.label}</h2>
            {activeNode && !activeNode.composite && <>
                <label>Instance</label>
            </>}
            {activeNode && activeNode.composite && <ChildData indent={0} children={child_data}/>}
            {activeNode && !activeNode.composite && <NodeData node={activeNode} label={false}/>}
            <div className='spacer' style={{flexGrow: 1}}/>
            {activeNode && activeNode.lmql && <>
                <h4>Query Code</h4>
                <div className='value'>Dependencies: <code>{activeNode && activeNode.lmql_dependencies}</code></div>
                <div className='value'>Arguments: <code>{activeNode && activeNode.lmql_inputs}</code></div>
                <LMQLCode>
                    {activeNode && activeNode.lmql}
                </LMQLCode>
                <br/>
                </>}
        </div>
        <div className='graph' ref={cy}/>
        <ul className='graph-toolbar'>
                <li>
                    <button onClick={() => {
                        cy.current.cy.layout(layout).run();
                        cy.current.cy.fit();
                    }}>
                        Re-Layout
                    </button>
                </li>
        </ul>
    </>
}