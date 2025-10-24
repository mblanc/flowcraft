- prompt vs text edge => multi parts?

- upscale node
- Processing Nodes : upscale, inpaint, outpaint, create mask, filters, ...
- Logic Nodes : branch, merge
 - Output Nodes? : To save the generated images and videos to a user's gallery or download them directly., integration with 3p?
- GCS storage => upload files
- Lyria/Chirp/Gemini 2.5 TTS

## Should have:

* Super Nodes:
  A Super Node is a special type of node that contains a complete, self-contained workflow within it. Think of it like creating a "function" in programming. You build a useful sequence of operations, and then you "package" it into a single, reusable block. This keeps your main workflow clean, organized, and allows you to reuse complex logic without rebuilding it every time.
  For example, you could create a "High-Quality Stylized Portrait" Super Node that takes a simple text prompt and internally performs text-to-image generation, face correction, upscaling, and applies a specific filter. On the main canvas, it's just one node.
  The Process: Step-by-Step User Journey
  Here is how a user would create and use a Super Node:
  Build the Sub-Workflow: The user first creates a functional group of nodes on the main canvas as they normally would. For instance, a Text Prompt node connected to a Stable Diffusion node, which is then connected to an Upscaler node.
  Select the Nodes: The user selects the nodes they want to group. This can be done via:
  Drag-and-Select: Clicking and dragging a selection box around the desired nodes.
  Shift-Click: Holding the 'Shift' key and clicking on each node individually.
  Create the Super Node: With the nodes selected, the user right-clicks on one of them to open a context menu and selects "Create Super Node from Selection".
  Automatic Replacement: The selected nodes and their internal connections are immediately removed from the canvas and replaced by a single, new "Super Node". Gen-Flow automatically re-wires any connections that were going into or out of the selected group to the new Super Node.
  Configuration: A modal window immediately opens, allowing the user to configure their new Super Node. This is the most critical step.
  Usage: The new Super Node now exists on the canvas. It can be treated like any other node. In the future, it would also be saved to a user's personal "My Nodes" library to be dragged and dropped into any workflow.
  UI/UX: How It Looks and Feels
  1. Visual Distinction:
  Super Nodes will have a distinct visual style to differentiate them from standard nodes. For example, a thicker border, a different background color (e.g., a subtle gradient), and a special "group" or "layers" icon in the header.
  2. The Creation Flow (Visualized):
  Selection: Selected nodes have a glowing outline.
  Right-Click Menu: The context menu is clean and clear, with "Create Super Node from Selection" prominently displayed.
  Transformation: A smooth animation collapses the selected nodes into the single new Super Node, visually reinforcing the grouping action.
  3. The Configuration Modal:
  This is a clean, tabbed interface that pops up right after creation:
  Tab 1: General
  Node Name: A text field for the user to name their node (e.g., "HD Stylizer").
  Node Description: A text area for a brief explanation of what it does.
  Node Color: A color picker to give the node a custom color on the canvas.
  Tab 2: Inputs
  This tab lists all the inputs that were automatically detected (connections that crossed into the group). Each input has a row with:
  Original Source: A read-only label showing where it came from (e.g., StableDiffusion_Node.prompt).
  Input Name: A text field to rename the input for clarity (e.g., change prompt to Main Subject). This name is what appears on the Super Node's input port.
  Actions: Reorder inputs, or hide an input if it should have a default value instead.
  Tab 3: Outputs
  Similar to the Inputs tab, this lists all automatically detected outputs. The user can rename them for clarity (e.g., change Upscaler_Node.image to Final_Image).
  Tab 4: Parameters
  This is the most powerful section. It presents a tree-view of every single parameter from every node inside the Super Node.
  For example:
  code
  Code
  - StableDiffusion_Node
    - [ ] Seed
    - [ ] CFG Scale
    - [ ] Steps
  - Upscaler_Node
    - [ ] Denoise Strength
  The user can check a box next to any parameter they want to "expose".
  When a parameter is exposed, it appears in the Super Node's properties panel on the right, just like a regular node parameter. This allows the user to control internal settings from the outside, without having to go "inside" the node. They can also rename the exposed parameter (e.g., rename CFG Scale to Stylistic Freedom).
  4. Interacting with a Super Node:
  Configuration: Clicking the Super Node on the canvas shows its exposed parameters in the main properties panel.
  "Entering" the Node: A user can double-click the Super Node to "zoom into" it. The main canvas view would then be replaced by the internal workflow of the Super Node, showing the original nodes that were grouped. A breadcrumb navigation at the top would appear: Main Workflow / HD Stylizer. The user can make detailed edits here and then click "Main Workflow" to go back.
  Inputs, Outputs, and Parameters Explained
  Inputs:
  How they are created: Automatically. Any connection edge that starts at a node outside the selection and ends at a node inside the selection becomes an input port on the new Super Node.
  Example: If a Text Prompt node was connected to the prompt input of a selected Stable Diffusion node, the Super Node will get one input, which the system might temporarily call StableDiffusion_Node_prompt.
  Outputs:
  How they are created: Automatically. Any connection edge that starts at a node inside the selection and ends at a node outside the selection becomes an output port.
  Example: If the image output of a selected Upscaler node was connected to a Save Image node, the Super Node will get one output port named Upscaler_Node_image.
  Parameters:
  How they are created: Manually by the user. They are not detected automatically. The user must explicitly choose which internal settings they want to control from the outside.
  Why this is important: Not every parameter should be exposed. A Super Node for a specific "Vintage Photo" style might have a fixed internal model and sampler, as those are key to the style. But the user would want to expose the Seed and Prompt to create different images in that style. This allows the creator of the Super Node to strike a balance between simplicity and control.
  By implementing Super Nodes this way, you give users the power to build their own libraries of custom, high-level tools, dramatically accelerating their creative process and making Gen-Flow a truly extensible platform.
* Batch Processing and Automation: The ability to run workflows on multiple inputs simultaneously, enabling the automated generation of large sets of images or video variations.
* Workflow Templates and Reusability: Users will be able to save their workflows as templates to be reused and shared with the community.

## Nice to Have:

* Custom Node Development: An SDK will be provided to allow developers to create and share their own custom nodes, extending the platform's functionality.
* Integration with Other Creative Tools: Plugins and integrations with popular creative software like Adobe Photoshop or Blender to streamline the creative process.
* AI Workflow Architect : agentic creation of flow
* Intelligent Parameter Tuning & A/B Testing: multiple param values
* The Gen-Flow Hub: A Curated Node & Workflow Marketplace
* Headless API Execution: Once a user perfects a workflow, they can click a "Generate API" button. Gen-Flow instantly creates a secure, private REST API endpoint for that workflow.
* Git-Style Version Control for Workflows
* Flow App Publisher
